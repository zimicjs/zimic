import {
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
  HttpFormData,
  HttpHeaders,
  HttpSearchParams,
  HttpSchema,
  HttpRequestSearchParamsSchema,
  HttpRequestHeadersSchema,
} from '@zimic/http';
import blobContains from '@zimic/utils/data/blobContains';
import blobEquals from '@zimic/utils/data/blobEquals';
import { Default, Range } from '@zimic/utils/types';

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
  InterceptedHttpInterceptorRequest,
} from './types/requests';
import {
  HttpRequestHandlerRestriction,
  RestrictionDiff,
  RestrictionDiffs,
  RestrictionMatchResult,
  HttpRequestHandlerStaticRestriction,
  UnmatchedHttpInterceptorRequestGroup,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_REQUEST_LIMITS: Range<number> = Object.freeze({
  min: 0,
  max: Infinity,
});

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
  private unmatchedRequestGroups: UnmatchedHttpInterceptorRequestGroup[] = [];
  private interceptedRequests: InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] =
    [];

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
    newThis.unmatchedRequestGroups.length = 0;
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
        requestLimits: this.limits.numberOfRequests,
        numberOfMatchedRequests: this.numberOfMatchedRequests,
        declarationPointer: this.timesDeclarationPointer,
        unmatchedRequestGroups: this.unmatchedRequestGroups,
        hasRestrictions: this.restrictions.length > 0,
        hasSavedRequests: this.interceptor.shouldSaveRequests(),
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
    this.unmatchedRequestGroups.length = 0;
    this.interceptedRequests.length = 0;

    this.createResponseDeclaration = undefined;

    return this;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>): Promise<boolean> {
    const hasDeclaredResponse = this.createResponseDeclaration !== undefined;

    if (!hasDeclaredResponse) {
      return false;
    }

    const restrictionsMatch = await this.matchesRequestRestrictions(request);

    if (restrictionsMatch.value) {
      this.numberOfMatchedRequests++;
    } else {
      const shouldSaveUnmatchedGroup =
        this.interceptor.shouldSaveRequests() &&
        this.restrictions.length > 0 &&
        this.timesDeclarationPointer !== undefined;

      if (shouldSaveUnmatchedGroup) {
        this.unmatchedRequestGroups.push({ request, diff: restrictionsMatch.diff });
      }
    }

    const isWithinLimits = this.numberOfMatchedRequests <= this.limits.numberOfRequests.max;
    return restrictionsMatch.value && isWithinLimits;
  }

  private async matchesRequestRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<RestrictionMatchResult<RestrictionDiffs>> {
    for (const restriction of this.restrictions) {
      if (this.isComputedRequestRestriction(restriction)) {
        const matchesComputedRestriction = await restriction(request);

        if (!matchesComputedRestriction) {
          return {
            value: false,
            diff: { computed: { expected: true, received: false } },
          };
        }

        continue;
      }

      const matchesHeadersRestrictions = this.matchesRequestHeadersRestrictions(request, restriction);
      const matchesSearchParamsRestrictions = this.matchesRequestSearchParamsRestrictions(request, restriction);
      const matchesBodyRestrictions = await this.matchesRequestBodyRestrictions(request, restriction);

      const matchesRestriction =
        matchesHeadersRestrictions.value && matchesSearchParamsRestrictions.value && matchesBodyRestrictions.value;

      if (!matchesRestriction) {
        return {
          value: false,
          diff: {
            headers: matchesHeadersRestrictions.diff,
            searchParams: matchesSearchParamsRestrictions.diff,
            body: matchesBodyRestrictions.diff,
          },
        };
      }
    }

    return { value: true };
  }

  private matchesRequestHeadersRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Method, Path>,
  ): RestrictionMatchResult<RestrictionDiff<HttpHeaders<never>>> {
    if (restriction.headers === undefined) {
      return { value: true };
    }

    const restrictedHeaders = new HttpHeaders(
      restriction.headers as HttpRequestHeadersSchema<Default<Schema[Path][Method]>>,
    );

    const matchesRestriction = restriction.exact
      ? request.headers.equals(restrictedHeaders)
      : request.headers.contains(restrictedHeaders);

    return matchesRestriction
      ? { value: true }
      : {
          value: false,
          diff: { expected: restrictedHeaders, received: request.headers },
        };
  }

  private matchesRequestSearchParamsRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Method, Path>,
  ): RestrictionMatchResult<RestrictionDiff<HttpSearchParams<never>>> {
    if (restriction.searchParams === undefined) {
      return { value: true };
    }

    const restrictedSearchParams = new HttpSearchParams(
      restriction.searchParams as HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>,
    );

    const matchesRestriction = restriction.exact
      ? request.searchParams.equals(restrictedSearchParams)
      : request.searchParams.contains(restrictedSearchParams);

    return matchesRestriction
      ? { value: true }
      : {
          value: false,
          diff: { expected: restrictedSearchParams, received: request.searchParams },
        };
  }

  private async matchesRequestBodyRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Method, Path>,
  ): Promise<RestrictionMatchResult<RestrictionDiff<unknown>>> {
    if (restriction.body === undefined) {
      return { value: true };
    }

    const body = request.body as unknown;
    const restrictionBody = restriction.body as unknown;

    if (typeof body === 'string' && typeof restrictionBody === 'string') {
      const matchesRestriction = restriction.exact ? body === restrictionBody : body.includes(restrictionBody);

      return matchesRestriction
        ? { value: true }
        : {
            value: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof HttpFormData) {
      if (!(body instanceof HttpFormData)) {
        return {
          value: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matchesRestriction = restriction.exact
        ? await body.equals(restrictionBody)
        : await body.contains(restrictionBody);

      return matchesRestriction
        ? { value: true }
        : {
            value: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof HttpSearchParams) {
      if (!(body instanceof HttpSearchParams)) {
        return {
          value: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matchesRestriction = restriction.exact ? body.equals(restrictionBody) : body.contains(restrictionBody);

      return matchesRestriction
        ? { value: true }
        : {
            value: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    if (restrictionBody instanceof Blob) {
      if (!(body instanceof Blob)) {
        return {
          value: false,
          diff: { expected: restrictionBody, received: body },
        };
      }

      const matchesRestriction = restriction.exact
        ? await blobEquals(body, restrictionBody)
        : await blobContains(body, restrictionBody);

      return matchesRestriction
        ? { value: true }
        : {
            value: false,
            diff: { expected: restrictionBody, received: body },
          };
    }

    const matchesRestriction = restriction.exact
      ? jsonEquals(request.body, restriction.body)
      : jsonContains(request.body, restriction.body);

    return matchesRestriction
      ? { value: true }
      : {
          value: false,
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
    const interceptedRequest = this.createInterceptedRequest(request, response);
    this.interceptedRequests.push(interceptedRequest);
  }

  private createInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    const interceptedRequest = request as unknown as InterceptedHttpInterceptorRequest<
      Path,
      Default<Schema[Path][Method]>,
      StatusCode
    >;

    Object.defineProperty(interceptedRequest, 'response', {
      value: response,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return interceptedRequest;
  }

  requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
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
