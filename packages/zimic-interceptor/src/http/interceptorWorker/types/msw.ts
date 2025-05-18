import { HttpResponse, HttpBody, HttpRequest } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import type { HttpHandler as MSWHandler } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

export type { MSWHandler, NodeMSWWorker, BrowserMSWWorker };

export type MSWWorker = NodeMSWWorker | BrowserMSWWorker;

export interface MSWHttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

export type MSWHttpResponseFactory<
  RequestBody extends HttpBody = HttpBody,
  ResponseBody extends HttpBody = HttpBody,
> = (context: MSWHttpResponseFactoryContext<RequestBody>) => PossiblePromise<HttpResponse<ResponseBody> | null>;
