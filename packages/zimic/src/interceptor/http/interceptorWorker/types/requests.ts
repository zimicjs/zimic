import type { SetupWorker as BrowserMSWWorker } from 'msw/browser';
import type { SetupServer as NodeMSWWorker } from 'msw/node';

import { HttpResponse, HttpBody, HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

export type HttpWorker = BrowserMSWWorker | NodeMSWWorker;
export { BrowserMSWWorker as BrowserHttpWorker, NodeMSWWorker as NodeHttpWorker };

export interface HttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

export type HttpResponseFactory<RequestBody extends HttpBody = HttpBody, ResponseBody extends HttpBody = HttpBody> = (
  context: HttpResponseFactoryContext<RequestBody>,
) => PossiblePromise<HttpResponse<ResponseBody> | null>;
