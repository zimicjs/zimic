import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default } from '@/types/utils';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestTrackerClient from './HttpRequestTrackerClient';
import {
  HttpRequestTrackerRestriction,
  LocalHttpRequestTracker as PublicLocalHttpRequestTracker,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class LocalHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>
{
  readonly type = 'local';

  private _client: HttpRequestTrackerClient<Schema, Method, Path, StatusCode>;

  constructor(interceptor: HttpInterceptorClient<Schema>, method: Method, path: Path) {
    this._client = new HttpRequestTrackerClient(interceptor, method, path, this);
  }

  client() {
    return this._client;
  }

  method() {
    return this._client.method();
  }

  path() {
    return this._client.path();
  }

  with(
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ): LocalHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.with(restriction);
    return this;
  }

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): LocalHttpRequestTracker<Schema, Method, Path, NewStatusCode> {
    this._client.respond(declaration);

    const newThis = this as unknown as LocalHttpRequestTracker<Schema, Method, Path, NewStatusCode>;
    return newThis;
  }

  bypass(): LocalHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.bypass();
    return this;
  }

  clear(): LocalHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.clear();
    return this;
  }

  requests(): readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[] {
    return this._client.requests();
  }

  matchesRequest(request: HttpInterceptorRequest<Default<Schema[Path][Method]>>): boolean {
    return this._client.matchesRequest(request);
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this._client.applyResponseDeclaration(request);
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this._client.registerInterceptedRequest(request, response);
  }
}

export default LocalHttpRequestTracker;
