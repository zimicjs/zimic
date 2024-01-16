import { PathParams, StrictRequest } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import { HttpRequestResolverExtras } from 'msw/lib/core/handlers/HttpHandler';
import { ResponseResolverInfo } from 'msw/lib/core/handlers/RequestHandler';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { PossiblePromise } from '@/types/utils';

import { HttpInterceptorRequestDefaultBody } from '../HttpInterceptor/types/schema';

export type MSWWorker = BrowserMSWWorker | NodeMSWWorker;

export { BrowserMSWWorker, NodeMSWWorker };

export type HttpRequestHandlerContext<
  Body extends HttpInterceptorRequestDefaultBody = HttpInterceptorRequestDefaultBody,
> = ResponseResolverInfo<HttpRequestResolverExtras<PathParams>, Body>;

export type HttpRequestHandlerRequest<
  Body extends HttpInterceptorRequestDefaultBody = HttpInterceptorRequestDefaultBody,
> = StrictRequest<Body>;

export interface EffectiveHttpRequestHandlerResult<
  Body extends HttpInterceptorRequestDefaultBody = HttpInterceptorRequestDefaultBody,
> {
  bypass?: never;
  status?: number;
  body?: Body;
}

export interface BypassedHttpRequestHandlerResult {
  bypass: true;
}

export type HttpRequestHandlerResult<
  Body extends HttpInterceptorRequestDefaultBody = HttpInterceptorRequestDefaultBody,
> = EffectiveHttpRequestHandlerResult<Body> | BypassedHttpRequestHandlerResult;

export type HttpRequestHandler = (context: HttpRequestHandlerContext) => PossiblePromise<HttpRequestHandlerResult>;
