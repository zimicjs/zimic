import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { HttpResponse, HttpBody, HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker as BrowserHttpWorker, NodeMSWWorker as NodeHttpWorker };

export interface HttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

export interface EffectiveHttpResponseFactoryResult<Body extends HttpBody = HttpBody> {
  bypass?: never;
  response: HttpResponse<Body>;
}

export interface BypassedHttpResponseFactoryResult {
  bypass: true;
  response?: never;
}

export type HttpResponseFactoryResult<Body extends HttpBody = HttpBody> =
  | EffectiveHttpResponseFactoryResult<Body>
  | BypassedHttpResponseFactoryResult;

export type HttpResponseFactory<RequestBody extends HttpBody = HttpBody, ResponseBody extends HttpBody = HttpBody> = (
  context: HttpResponseFactoryContext<RequestBody>,
) => PossiblePromise<HttpResponseFactoryResult<ResponseBody>>;
