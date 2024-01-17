import { PathParams } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import { HttpRequestResolverExtras } from 'msw/lib/core/handlers/HttpHandler';
import { ResponseResolverInfo } from 'msw/lib/core/handlers/RequestHandler';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { PossiblePromise } from '@/types/utils';

import { HttpInterceptorDefaultBody } from '../HttpInterceptor/types/schema';

export type MSWWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker, NodeMSWWorker };

export type HttpRequestHandlerContext<Body extends HttpInterceptorDefaultBody = HttpInterceptorDefaultBody> =
  ResponseResolverInfo<HttpRequestResolverExtras<PathParams>, Body>;

export interface HttpRequestHandlerRequest<Body extends HttpInterceptorDefaultBody> extends Request {
  json: () => Promise<Body>;
}

export interface EffectiveHttpRequestHandlerResult<
  Body extends HttpInterceptorDefaultBody = HttpInterceptorDefaultBody,
> {
  bypass?: never;
  status?: number;
  body?: Body;
}

export interface BypassedHttpRequestHandlerResult {
  bypass: true;
  status?: never;
  body?: never;
}

export type HttpRequestHandlerResult<Body extends HttpInterceptorDefaultBody = HttpInterceptorDefaultBody> =
  | EffectiveHttpRequestHandlerResult<Body>
  | BypassedHttpRequestHandlerResult;

export type HttpRequestHandler<
  RequestBody extends HttpInterceptorDefaultBody = HttpInterceptorDefaultBody,
  ResponseBody extends HttpInterceptorDefaultBody = HttpInterceptorDefaultBody,
> = (context: HttpRequestHandlerContext<RequestBody>) => PossiblePromise<HttpRequestHandlerResult<ResponseBody>>;
