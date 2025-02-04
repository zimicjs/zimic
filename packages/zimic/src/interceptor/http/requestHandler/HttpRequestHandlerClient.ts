import HttpFormData from '@/http/formData/HttpFormData';
import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpStatusCode } from '@/http/types/schema';
import { Default } from '@/types/utils';
import { blobContains, blobEquals } from '@/utils/data';
import { jsonContains, jsonEquals } from '@/utils/json';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import DisabledRequestSavingError from './errors/DisabledRequestSavingError';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import TimesCheckError from './errors/TimesCheckError';
import TimesDeclarationPointer from './errors/TimesDeclarationPointer';
import { InternalHttpRequestHandler } from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';
import {
  HttpRequestHandlerRestriction,
  RestrictionDiff,
  RestrictionDiffs,
  RestrictionMatchResult,
  HttpRequestHandlerStaticRestriction,
  UnmatchedHttpInterceptorRequestGroup,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_REQUEST_LIMITS = { min: 0, max: Infinity };

class HttpRequestHandlerClient<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> {
  private restrictions: HttpRequestHandlerRestriction<Schema, Method, Path>[] = [];

  private limits = {
    numberOfRequests: DEFAULT_NUMBER_OF_REQUEST_LIMITS,
  };

  private timesDeclarationPointer?: TimesDeclarationPointer;

  private numberOfMatchedRequests = 0;

  private unmatchedGroups: UnmatchedHttpInterceptorRequestGroup[] = [];
  private interceptedRequests: TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] = [];

  private createResponseDeclaration?: HttpRequestHandlerResponseDeclarationFactory<
    Path,
    Default<Schema[Path][Method]>,
    StatusCode
  >;

  constructor(
    private interceptor: HttpInterceptorClient<Schema>,
    private _method: Method,
    private _path: Path,
    private handler: InternalHttpRequestHandler<Schema, Method, Path, StatusCode>,
  ) {}

  method() {
    return this._method;
  }

  path() {
    return this._path;
  }

  with(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>): this {
    this.restrictions.push(restriction);
    return this;
  }

  respond<NewStatusCode extends HttpStatusCode>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): HttpRequestHandlerClient<Schema, Method, Path, NewStatusCode> {
    const newThis = this as unknown as HttpRequestHandlerClient<Schema, Method, Path, NewStatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory(declaration)
      ? declaration
      : () => declaration;

    newThis.numberOfMatchedRequests = 0;
    newThis.unmatchedGroups.length = 0;
    newThis.interceptedRequests.length = 0;

    this.interceptor.registerRequestHandler(this.handler);

    return newThis;
  }

  private isResponseDeclarationFactory(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>>,
  ) {
    return typeof declaration === 'function';
  }

  times(
    minNumberOfRequests: number,
    maxNumberOfRequests?: number,
  ): HttpRequestHandlerClient<Schema, Method, Path, StatusCode> {
    this.limits.numberOfRequests = {
      min: minNumberOfRequests,
      max: maxNumberOfRequests ?? minNumberOfRequests,
    };

    this.timesDeclarationPointer = new TimesDeclarationPointer(minNumberOfRequests, maxNumberOfRequests);

    return this;
  }

  checkTimes() {
    const isWithinLimits =
      this.numberOfMatchedRequests >= this.limits.numberOfRequests.min &&
      this.numberOfMatchedRequests <= this.limits.numberOfRequests.max;

    if (!isWithinLimits) {
      throw new TimesCheckError({
        limits: this.limits.numberOfRequests,
        numberOfRequests: this.numberOfMatchedRequests,
        declarationPointer: this.timesDeclarationPointer,
        unmatchedGroups: this.unmatchedGroups,
        hasRestrictions: this.restrictions.length > 0,
        savedRequests: this.interceptor.shouldSaveRequests(),
      });
    }
  }

  clear(): this {
    this.restrictions.length = 0;

    this.limits = {
      numberOfRequests: DEFAULT_NUMBER_OF_REQUEST_LIMITS,
    };

    this.timesDeclarationPointer = undefined;

    this.numberOfMatchedRequests = 0;
    this.unmatchedGroups.length = 0;
    this.interceptedRequests.length = 0;

    this.createResponseDeclaration = undefined;

    return this;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>): Promise<boolean> {
    const hasDeclaredResponse = this.createResponseDeclaration !== undefined;

    if (!hasDeclaredResponse) {
      return false;
    }

    const restrictionsResult = await this.compareToRequestRestrictions(request);

    if (restrictionsResult.matched) {
      this.numberOfMatchedRequests++;
    } else {
      const shouldSaveUnmatchedGroup =
        this.interceptor.shouldSaveRequests() &&
        this.restrictions.length > 0 &&
        this.timesDeclarationPointer !== undefined;

      if (shouldSaveUnmatchedGroup) {
        this.unmatchedGroups.push({ request, diff: restrictionsResult.diff });
      }
    }

    const isWithinLimits = this.numberOfMatchedRequests <= this.limits.numberOfRequests.max;
    return restrictionsResult.matched && isWithinLimits;
  }

  private async compareToRequestRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<RestrictionMatchResult<RestrictionDiffs>> {
    for (const restriction of this.restrictions) {
      if (this.isComputedRequestRestriction(restriction)) {
        const matchesComputedRestriction = await restriction(request);

        if (matchesComputedRestriction) {
          return { matched: true };
        } else {
          return {
            matched: false,
            diff: {
              computed: { expected: true, received: false },
            },
          };
        }
      }

      const headersResult = this.matchesRequestHeadersRestrictions(request, restriction);
      const searchParamsResult = this.matchesRequestSearchParamsRestrictions(request, restriction);
      const bodyResult = await this.matchesRequestBodyRestrictions(request, restriction);

      const matched = headersResult.matched && searchParamsResult.matched && bodyResult.matched;

      if (!matched) {
        return {
          matched: false,
          diff: {
            headers: headersResult.matched ? undefined : headersResult.diff,
            searchParams: searchParamsResult.matched ? undefined : searchParamsResult.diff,
            body: bodyResult.matched ? undefined : bodyResult.diff,
          },
        };
      }
    }

    return { matched: true };
  }

  private matchesRequestHeadersRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ): RestrictionMatchResult<RestrictionDiff<HttpHeaders<never>>> {
    if (restriction.headers === undefined) {
      return { matched: true };
    }

    const restrictedHeaders = new HttpHeaders(restriction.headers as never);

    const matched = restriction.exact
      ? request.headers.equals(restrictedHeaders)
      : request.headers.contains(restrictedHeaders);

    return matched
      ? { matched: true }
      : {
          matched: false,
          diff: { expected: restrictedHeaders, received: request.headers },
        };
  }

  private matchesRequestSearchParamsRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ): RestrictionMatchResult<RestrictionDiff<HttpSearchParams<never>>> {
    if (restriction.searchParams === undefined) {
      return { matched: true };
    }

    const restrictedSearchParams = new HttpSearchParams(restriction.searchParams as never);

    const matched = restriction.exact
      ? request.searchParams.equals(restrictedSearchParams)
      : request.searchParams.contains(restrictedSearchParams);

    return matched
      ? { matched: true }
      : {
          matched: false,
          diff: { expected: restrictedSearchParams, received: request.searchParams },
        };
  }

  private async matchesRequestBodyRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ): Promise<RestrictionMatchResult<RestrictionDiff<unknown>>> {
    if (restriction.body === undefined) {
      return { matched: true };
    }

    const body = request.body as unknown;
    const restrictionBody = restriction.body as unknown;

    if (typeof body === 'string' && typeof restrictionBody === 'string') {
      const matched = restriction.exact ? body === restrictionBody : body.includes(restrictionBody);

      return matched
        ? { matched: true }
        : {
            matched: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof HttpFormData) {
      if (!(body instanceof HttpFormData)) {
        return {
          matched: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matched = restriction.exact ? await body.equals(restrictionBody) : await body.contains(restrictionBody);

      return matched
        ? { matched }
        : {
            matched: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof HttpSearchParams) {
      if (!(body instanceof HttpSearchParams)) {
        return {
          matched: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matched = restriction.exact ? body.equals(restrictionBody) : body.contains(restrictionBody);

      return matched
        ? { matched }
        : {
            matched: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof Blob) {
      if (!(body instanceof Blob)) {
        return {
          matched: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matched = restriction.exact
        ? await blobEquals(body, restrictionBody)
        : await blobContains(body, restrictionBody);

      return matched
        ? { matched }
        : {
            matched: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    const matched = restriction.exact
      ? jsonEquals(request.body, restriction.body)
      : jsonContains(request.body, restriction.body);

    return matched
      ? { matched: true }
      : {
          matched: false,
          diff: { expected: restrictionBody, received: body },
        };
  }

  private isComputedRequestRestriction(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>) {
    return typeof restriction === 'function';
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    if (!this.createResponseDeclaration) {
      throw new NoResponseDefinitionError();
    }
    const appliedDeclaration = await this.createResponseDeclaration(request);
    return appliedDeclaration;
  }

  saveInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    const interceptedRequest = this.createInterceptedRequestProxy(request, response);
    this.interceptedRequests.push(interceptedRequest);
  }

  private createInterceptedRequestProxy(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    return new Proxy(
      request as unknown as TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>,
      {
        get(target, property) {
          if (property === 'response') {
            return response satisfies HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>;
          }
          return Reflect.get(target, property, target) as unknown;
        },
      },
    );
  }

  requests(): readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    if (!this.interceptor.shouldSaveRequests()) {
      throw new DisabledRequestSavingError();
    }

    const interceptedRequestsCopy = [...this.interceptedRequests];
    Object.freeze(interceptedRequestsCopy);
    return interceptedRequestsCopy;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpRequestHandlerClient = HttpRequestHandlerClient<any, any, any, any>;

export default HttpRequestHandlerClient;
