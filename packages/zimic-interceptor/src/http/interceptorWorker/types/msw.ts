import { HttpResponse, HttpBody } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import type { HttpHandler as MSWHandler } from 'msw';
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { HttpResponseFactoryContext, HttpHandlerActionResult } from './http';

export type { MSWHandler, NodeMSWWorker, BrowserMSWWorker };

export type MSWWorker = NodeMSWWorker | BrowserMSWWorker;

export type MSWHttpResponseFactory<
  RequestBody extends HttpBody = HttpBody,
  ResponseBody extends HttpBody = HttpBody,
> = (
  context: HttpResponseFactoryContext<RequestBody>,
) => PossiblePromise<HttpResponse<ResponseBody> | HttpHandlerActionResult | null>;
