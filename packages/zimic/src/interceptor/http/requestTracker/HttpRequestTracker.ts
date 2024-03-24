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

import HttpInterceptor from '../interceptor/HttpInterceptor';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import {
  HttpRequestTrackerRestriction,
  HttpRequestTrackerComputedRestriction,
  HttpRequestTracker as PublicHttpRequestTracker,
  HttpRequestTrackerStaticRestriction,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class HttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicHttpRequestTracker<Schema, Method, Path, StatusCode>
{
  private restrictions: HttpRequestTrackerRestriction<Schema, Method, Path>[] = [];
  private interceptedRequests: TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[] = [];

  private createResponseDeclaration?: HttpRequestTrackerResponseDeclarationFactory<
    Default<Schema[Path][Method]>,
    StatusCode
  >;

  constructor(
    private interceptor: HttpInterceptor<Schema>,
    private _method: Method,
    private _path: Path,
  ) {}

  method() {
    return this._method;
  }

  path() {
    return this._path;
  }

  with(
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ): HttpRequestTracker<Schema, Method, Path, StatusCode> {
    this.restrictions.push(restriction);
    return this;
  }

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): HttpRequestTracker<Schema, Method, Path, NewStatusCode> {
    const newThis = this as unknown as HttpRequestTracker<Schema, Method, Path, NewStatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory<NewStatusCode>(declaration)
      ? declaration
      : () => declaration;

    newThis.interceptedRequests = [];

    this.interceptor.registerRequestTracker(newThis);

    return newThis;
  }

  private isResponseDeclarationFactory<
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ): declaration is HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode> {
    return typeof declaration === 'function';
  }

  bypass(): HttpRequestTracker<Schema, Method, Path, StatusCode> {
    this.createResponseDeclaration = undefined;
    return this;
  }

  clear(): HttpRequestTracker<Schema, Method, Path, StatusCode> {
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
    restriction: HttpRequestTrackerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.headers === undefined) {
      return true;
    }

    const restrictedHeaders = new HttpHeaders(restriction.headers);
    return restriction.exact ? request.headers.equals(restrictedHeaders) : request.headers.contains(restrictedHeaders);
  }

  private matchesRequestSearchParamsRestrictions(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    restriction: HttpRequestTrackerStaticRestriction<Schema, Path, Method>,
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
    restriction: HttpRequestTrackerStaticRestriction<Schema, Path, Method>,
  ) {
    if (restriction.body === undefined) {
      return true;
    }

    return restriction.exact
      ? jsonEquals(request.body, restriction.body)
      : jsonContains(request.body, restriction.body);
  }

  private isComputedRequestRestriction(
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ): restriction is HttpRequestTrackerComputedRestriction<Schema, Method, Path> {
    return typeof restriction === 'function';
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
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
    return this.interceptedRequests;
  }
}

export default HttpRequestTracker;
