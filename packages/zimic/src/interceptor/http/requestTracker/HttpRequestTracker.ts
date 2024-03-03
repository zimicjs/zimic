import { Default } from '@/types/utils';

import HttpInterceptor from '../interceptor/HttpInterceptor';
import {
  HttpInterceptorResponseSchemaStatusCode,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
} from '../interceptor/types/schema';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import { HttpRequestTracker as PublicHttpRequestTracker } from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class HttpRequestTracker<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
  Path extends HttpInterceptorSchemaPath<Schema, Method>,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<
    Default<Default<Schema[Path][Method]>['response']>
  > = never,
> implements PublicHttpRequestTracker<Schema, Method, Path, StatusCode>
{
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

  respond<
    NewStatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
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
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ): declaration is HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode> {
    return typeof declaration === 'function';
  }

  bypass(): HttpRequestTracker<Schema, Method, Path, StatusCode> {
    this.createResponseDeclaration = undefined;
    this.interceptedRequests = [];
    return this;
  }

  matchesRequest(_request: HttpInterceptorRequest<Default<Schema[Path][Method]>>): boolean {
    return this.createResponseDeclaration !== undefined;
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
