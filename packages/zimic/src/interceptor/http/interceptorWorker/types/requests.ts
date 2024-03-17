import { PathParams } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import { HttpRequestResolverExtras } from 'msw/lib/core/handlers/HttpHandler';
import { ResponseResolverInfo } from 'msw/lib/core/handlers/RequestHandler';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { HttpResponse, DefaultLooseBody } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker as BrowserHttpWorker, NodeMSWWorker as NodeHttpWorker };

export type HttpRequestHandlerContext<Body extends DefaultLooseBody = DefaultLooseBody> = ResponseResolverInfo<
  HttpRequestResolverExtras<PathParams>,
  Body
>;

export interface EffectiveHttpRequestHandlerResult<Body extends DefaultLooseBody = DefaultLooseBody> {
  bypass?: never;
  response: HttpResponse<Body>;
}

export interface BypassedHttpRequestHandlerResult {
  bypass: true;
  response?: never;
}

export type HttpRequestHandlerResult<Body extends DefaultLooseBody = DefaultLooseBody> =
  | EffectiveHttpRequestHandlerResult<Body>
  | BypassedHttpRequestHandlerResult;

export type HttpRequestHandler<
  RequestBody extends DefaultLooseBody = DefaultLooseBody,
  ResponseBody extends DefaultLooseBody = DefaultLooseBody,
> = (context: HttpRequestHandlerContext<RequestBody>) => PossiblePromise<HttpRequestHandlerResult<ResponseBody>>;
