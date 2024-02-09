import { PathParams } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import { HttpRequestResolverExtras } from 'msw/lib/core/handlers/HttpHandler';
import { ResponseResolverInfo } from 'msw/lib/core/handlers/RequestHandler';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { JSONValue } from '@/types/json';
import { PossiblePromise } from '@/types/utils';

export type HttpWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker as BrowserHttpWorker, NodeMSWWorker as NodeHttpWorker };

/** The default body type (JSON) for HTTP requests and responses. */
export type DefaultBody = JSONValue;

export type HttpRequestHandlerContext<Body extends DefaultBody = DefaultBody> = ResponseResolverInfo<
  HttpRequestResolverExtras<PathParams>,
  Body
>;

/** An HTTP request with a strictly-typed JSON body. */
export interface HttpRequest<StrictBody extends DefaultBody = DefaultBody> extends Request {
  json: () => Promise<StrictBody>;
}

/** An HTTP response with a strictly-typed JSON body and status code. */
export interface HttpResponse<StrictBody extends DefaultBody = DefaultBody, StatusCode extends number = number>
  extends Response {
  status: StatusCode;
  json: () => Promise<StrictBody>;
}

export interface EffectiveHttpRequestHandlerResult<Body extends DefaultBody = DefaultBody> {
  bypass?: never;
  response: HttpResponse<Body>;
}

export interface BypassedHttpRequestHandlerResult {
  bypass: true;
  response?: never;
}

export type HttpRequestHandlerResult<Body extends DefaultBody = DefaultBody> =
  | EffectiveHttpRequestHandlerResult<Body>
  | BypassedHttpRequestHandlerResult;

export type HttpRequestHandler<
  RequestBody extends DefaultBody = DefaultBody,
  ResponseBody extends DefaultBody = DefaultBody,
> = (context: HttpRequestHandlerContext<RequestBody>) => PossiblePromise<HttpRequestHandlerResult<ResponseBody>>;
