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
import {
  HttpRequestHandlerRestriction,
  HttpRequestHandlerStaticRestriction,
  InternalHttpRequestHandler,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class HttpRequestHandlerClient<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> {
  private restrictions: HttpRequestHandlerRestriction<Schema, Method, Path>[] = [];
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

  with(
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ): HttpRequestHandlerClient<Schema, Method, Path, StatusCode> {
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
    newThis.interceptedRequests = [];

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

  bypass(): HttpRequestHandlerClient<Schema, Method, Path, StatusCode> {
    this.createResponseDeclaration = undefined;
    return this;
  }

  clear(): HttpRequestHandlerClient<Schema, Method, Path, StatusCode> {
    this.restrictions = [];
    this.interceptedRequests = [];
    return this.bypass();
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>): Promise<boolean> {
    const hasDeclaredResponse = this.createResponseDeclaration !== undefined;
    return hasDeclaredResponse && (await this.matchesRequestRestrictions(request));
  }

  private async matchesRequestRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<boolean> {
    for (const restriction of this.restrictions) {
      const matchesRestriction = this.isComputedRequestRestriction(restriction)
        ? await restriction(request)
        : this.matchesRequestHeadersRestrictions(request, restriction) &&
          this.matchesRequestSearchParamsRestrictions(request, restriction) &&
          (await this.matchesRequestBodyRestrictions(request, restriction));

      if (!matchesRestriction) {
        return false;
      }
    }

    return true;
  }

  private matchesRequestHeadersRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.headers === undefined) {
      return true;
    }

    const restrictedHeaders = new HttpHeaders(
      restriction.headers as HttpRequestHeadersSchema<Default<Schema[Path][Method]>>,
    );
    return restriction.exact ? request.headers.equals(restrictedHeaders) : request.headers.contains(restrictedHeaders);
  }

  private matchesRequestSearchParamsRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.searchParams === undefined) {
      return true;
    }

    const restrictedSearchParams = new HttpSearchParams(
      restriction.searchParams as HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>,
    );
    return restriction.exact
      ? request.searchParams.equals(restrictedSearchParams)
      : request.searchParams.contains(restrictedSearchParams);
  }

  private async matchesRequestBodyRestrictions(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.body === undefined) {
      return true;
    }

    const body = request.body as unknown;
    const restrictionBody = restriction.body as unknown;

    if (typeof body === 'string' && typeof restrictionBody === 'string') {
      return restriction.exact ? body === restrictionBody : body.includes(restrictionBody);
    }

    if (restrictionBody instanceof HttpFormData) {
      if (!(body instanceof HttpFormData)) {
        return false;
      }
      return restriction.exact ? body.equals(restrictionBody) : body.contains(restrictionBody);
    }

    if (restrictionBody instanceof HttpSearchParams) {
      if (!(body instanceof HttpSearchParams)) {
        return false;
      }
      return restriction.exact ? body.equals(restrictionBody) : body.contains(restrictionBody);
    }

    if (restrictionBody instanceof Blob) {
      if (!(body instanceof Blob)) {
        return false;
      }
      return restriction.exact ? blobEquals(body, restrictionBody) : blobContains(body, restrictionBody);
    }

    return restriction.exact
      ? jsonEquals(request.body, restriction.body)
      : jsonContains(request.body, restriction.body);
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
