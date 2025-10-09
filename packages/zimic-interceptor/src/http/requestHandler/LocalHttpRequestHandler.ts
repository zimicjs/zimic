import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpStatusCode } from '@zimic/http';
import { Default } from '@zimic/utils/types';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestHandlerClient from './HttpRequestHandlerClient';
import { InternalHttpRequestHandler } from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  InterceptedHttpInterceptorRequest,
} from './types/requests';
import { HttpRequestHandlerRestriction } from './types/restrictions';

class LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> implements InternalHttpRequestHandler<Schema, Method, Path, StatusCode>
{
  readonly type = 'local';

  client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;

  constructor(interceptor: HttpInterceptorClient<Schema>, method: Method, path: Path) {
    this.client = new HttpRequestHandlerClient(interceptor, method, path, this);
  }

  get method() {
    return this.client.method;
  }

  get path() {
    return this.client.path;
  }

  with(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>): this {
    this.client.with(restriction);
    return this;
  }

  respond<NewStatusCode extends HttpStatusCode>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    this.client.respond(declaration);

    const newThis = this as unknown as LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    return newThis;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number): this {
    this.client.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  checkTimes() {
    this.client.checkTimes();
  }

  clear(): this {
    this.client.clear();
    return this;
  }

  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    return this.client.requests;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    const requestMatch = await this.client.matchesRequest(request);

    if (requestMatch.success) {
      this.client.markRequestAsMatched(request);
    } else if (requestMatch.cause === 'unmatchedRestrictions') {
      this.client.markRequestAsUnmatched(request, { diff: requestMatch.diff });
    } else {
      this.client.markRequestAsMatched(request);
    }

    return requestMatch;
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this.client.applyResponseDeclaration(request);
  }

  saveInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this.client.saveInterceptedRequest(request, response);
  }
}

export type AnyLocalHttpRequestHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | LocalHttpRequestHandler<any, any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | LocalHttpRequestHandler<any, any, any, any>;

export default LocalHttpRequestHandler;
