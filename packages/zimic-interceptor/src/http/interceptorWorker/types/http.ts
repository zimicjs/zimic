import { HttpBody, HttpRequest } from '@zimic/http';

export interface HttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}
