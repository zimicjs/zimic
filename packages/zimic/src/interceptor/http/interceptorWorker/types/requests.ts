import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { HttpResponse, HttpBody, HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker as BrowserHttpWorker, NodeMSWWorker as NodeHttpWorker };

export interface HttpRequestHandlerContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

export interface EffectiveHttpRequestHandlerResult<Body extends HttpBody = HttpBody> {
  bypass?: never;
  response: HttpResponse<Body>;
}

export interface BypassedHttpRequestHandlerResult {
  bypass: true;
  response?: never;
}

export type HttpRequestHandlerResult<Body extends HttpBody = HttpBody> =
  | EffectiveHttpRequestHandlerResult<Body>
  | BypassedHttpRequestHandlerResult;

export type HttpRequestHandler<
  RequestBody extends HttpBody = HttpBody,
  ResponseBody extends HttpBody = HttpBody,
> = (context: { request: HttpRequest<RequestBody> }) => PossiblePromise<HttpRequestHandlerResult<ResponseBody>>;
