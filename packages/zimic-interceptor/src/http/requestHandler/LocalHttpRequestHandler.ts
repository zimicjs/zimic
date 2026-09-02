import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpStatusCode } from '@zimic/http';
import { Default } from '@zimic/utils/types';

import HttpInterceptorImplementation from '../interceptor/HttpInterceptorImplementation';
import HttpRequestHandlerImplementation from './HttpRequestHandlerImplementation';
import { InternalHttpRequestHandler } from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDelayFactory,
  InterceptedHttpInterceptorRequest,
} from './types/requests';
import { HttpRequestHandlerRestriction } from './types/restrictions';

class LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> implements InternalHttpRequestHandler<Schema, Method, Path, StatusCode> {
  readonly type = 'local';

  implementation: HttpRequestHandlerImplementation<Schema, Method, Path, StatusCode>;

  constructor(interceptor: HttpInterceptorImplementation<Schema>, method: Method, path: Path) {
    this.implementation = new HttpRequestHandlerImplementation(interceptor, method, path, this);
  }

  get method() {
    return this.implementation.method;
  }

  get path() {
    return this.implementation.path;
  }

  with(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>): this {
    this.implementation.with(restriction);
    return this;
  }

  delay(
    minMilliseconds: number | HttpRequestHandlerResponseDelayFactory<Path, Default<Schema[Path][Method]>>,
    maxMilliseconds?: number,
  ): this {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this;
  }

  respond<NewStatusCode extends HttpStatusCode>(
    declaration: HttpRequestHandlerResponseDeclaration<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    this.implementation.respond(declaration);

    const newThis = this as unknown as LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    return newThis;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number): this {
    this.implementation.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear(): this {
    this.implementation.clear();
    return this;
  }

  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    return this.implementation.requests;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    const requestMatch = await this.implementation.matchesRequest(request);

    if (requestMatch.success) {
      this.implementation.markRequestAsMatched(request);
    } else if (requestMatch.cause === 'unmatchedRestrictions') {
      this.implementation.markRequestAsUnmatched(request, { diff: requestMatch.diff });
    } else {
      this.implementation.markRequestAsMatched(request);
    }

    return requestMatch;
  }

  async applyResponseDeclaration(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    return this.implementation.applyResponseDeclaration(request);
  }

  saveInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this.implementation.saveInterceptedRequest(request, response);
  }
}

export type AnyLocalHttpRequestHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | LocalHttpRequestHandler<any, any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | LocalHttpRequestHandler<any, any, any, any>;

export default LocalHttpRequestHandler;
