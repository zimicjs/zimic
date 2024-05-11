import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default } from '@/types/utils';
import { jsonContains, jsonEquals } from '@/utils/json';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import LocalHttpRequestHandler from './LocalHttpRequestHandler';
import RemoteHttpRequestHandler from './RemoteHttpRequestHandler';
import {
  HttpRequestHandlerRestriction,
  HttpRequestHandlerComputedRestriction,
  HttpRequestHandlerStaticRestriction,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class HttpRequestHandlerClient<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> {
  private restrictions: HttpRequestHandlerRestriction<Schema, Method, Path>[] = [];
  private interceptedRequests: TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[] = [];

  private createResponseDeclaration?: HttpRequestHandlerResponseDeclarationFactory<
    Default<Schema[Path][Method]>,
    StatusCode
  >;

  constructor(
    private interceptor: HttpInterceptorClient<Schema>,
    private _method: Method,
    private _path: Path,
    private handler:
      | LocalHttpRequestHandler<Schema, Method, Path, StatusCode>
      | RemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
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

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): HttpRequestHandlerClient<Schema, Method, Path, NewStatusCode> {
    const newThis = this as unknown as HttpRequestHandlerClient<Schema, Method, Path, NewStatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory<NewStatusCode>(declaration)
      ? declaration
      : () => declaration;
    newThis.interceptedRequests = [];

    this.interceptor.registerRequestHandler(this.handler);

    return newThis;
  }

  private isResponseDeclarationFactory<
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ): declaration is HttpRequestHandlerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode> {
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

  matchesRequest(request: HttpInterceptorRequest<Default<Schema[Path][Method]>>): boolean {
    const hasDeclaredResponse = this.createResponseDeclaration !== undefined;
    return hasDeclaredResponse && this.matchesRequestRestrictions(request);
  }

  private matchesRequestRestrictions(request: HttpInterceptorRequest<Default<Schema[Path][Method]>>): boolean {
    return this.restrictions.every((restriction) => {
      if (this.isComputedRequestRestriction(restriction)) {
        return restriction(request);
      }
      return (
        this.matchesRequestHeadersRestrictions(request, restriction) &&
        this.matchesRequestSearchParamsRestrictions(request, restriction) &&
        this.matchesRequestBodyRestrictions(request, restriction)
      );
    });
  }

  private matchesRequestHeadersRestrictions(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.headers === undefined) {
      return true;
    }

    const restrictedHeaders = new HttpHeaders(restriction.headers);
    return restriction.exact ? request.headers.equals(restrictedHeaders) : request.headers.contains(restrictedHeaders);
  }

  private matchesRequestSearchParamsRestrictions(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.searchParams === undefined) {
      return true;
    }

    const restrictedSearchParams = new HttpSearchParams(restriction.searchParams);
    return restriction.exact
      ? request.searchParams.equals(restrictedSearchParams)
      : request.searchParams.contains(restrictedSearchParams);
  }

  private matchesRequestBodyRestrictions(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    restriction: HttpRequestHandlerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.body === undefined) {
      return true;
    }

    return restriction.exact
      ? jsonEquals(request.body, restriction.body)
      : jsonContains(request.body, restriction.body);
  }

  private isComputedRequestRestriction(
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ): restriction is HttpRequestHandlerComputedRestriction<Schema, Method, Path> {
    return typeof restriction === 'function';
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    if (!this.createResponseDeclaration) {
      throw new NoResponseDefinitionError();
    }
    const appliedDeclaration = await this.createResponseDeclaration(request);
    return appliedDeclaration;
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    const interceptedRequest = this.createInterceptedRequestProxy(request, response);
    this.interceptedRequests.push(interceptedRequest);
  }

  private createInterceptedRequestProxy(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    return new Proxy(request as unknown as TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>, {
      get(target, property) {
        if (property === 'response') {
          return response satisfies HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });
  }

  requests(): readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[] {
    const interceptedRequestsCopy = [...this.interceptedRequests];
    Object.freeze(interceptedRequestsCopy);
    return interceptedRequestsCopy;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpRequestHandlerClient = HttpRequestHandlerClient<any, any, any, any>;

export default HttpRequestHandlerClient;