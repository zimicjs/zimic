import { HttpResponse, HttpBody, HttpRequest } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import type { HttpHandler as MSWHandler } from 'msw';
// MSW types are incorrect after 2.8. ESLint is flagging the import as duplicate, but it is not, so let's ignore it.
// eslint-disable-next-line import/no-duplicates
import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
// MSW types are incorrect after 2.8. ESLint is flagging the import as duplicate, but it is not, so let's ignore it.
// eslint-disable-next-line import/no-duplicates
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
