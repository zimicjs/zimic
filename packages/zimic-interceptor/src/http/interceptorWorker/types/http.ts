import { HttpBody, HttpRequest, HttpResponse } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

export interface HttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

export type HttpResponseFactory<RequestBody extends HttpBody = HttpBody, ResponseBody extends HttpBody = HttpBody> = (
  context: HttpResponseFactoryContext<RequestBody>,
) => PossiblePromise<HttpResponse<ResponseBody> | null>;
