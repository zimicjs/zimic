import { HttpBody, HttpRequest } from '@zimic/http';

export interface HttpResponseFactoryContext<Body extends HttpBody = HttpBody> {
  request: HttpRequest<Body>;
}

/** Result from a handler that can be an action (bypass/reject) or null (no response). */
export type HttpHandlerActionResult = { action: 'bypass' | 'reject' } | null;
