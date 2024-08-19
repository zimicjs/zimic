import { HttpResponseSchemaStatusCode, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http/types/schema';
import { Default } from '@/types/utils';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestHandlerClient from './HttpRequestHandlerClient';
import {
  HttpRequestHandlerRestriction,
  LocalHttpRequestHandler as PublicLocalHttpRequestHandler,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicLocalHttpRequestHandler<Schema, Method, Path, StatusCode>
{
  readonly type = 'local';

  private _client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;

  constructor(interceptor: HttpInterceptorClient<Schema>, method: Method, path: Path) {
    this._client = new HttpRequestHandlerClient(interceptor, method, path, this);
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
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ): LocalHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.with(restriction);
    return this;
  }

  respond<NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    this._client.respond(declaration);

    const newThis = this as unknown as LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    return newThis;
  }

  bypass(): LocalHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.bypass();
    return this;
  }

  clear(): LocalHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.clear();
    return this;
  }

  requests(): readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    return this._client.requests();
  }

  matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>): Promise<boolean> {
    return this._client.matchesRequest(request);
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this._client.applyResponseDeclaration(request);
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this._client.saveInterceptedRequest(request, response);
  }
}

export default LocalHttpRequestHandler;
