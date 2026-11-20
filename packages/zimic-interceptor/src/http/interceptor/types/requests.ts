import { HttpBody, HttpSchema } from '@zimic/http';

import { HttpInterceptorRequest } from '../../requestHandler/types/requests';

export type UnhandledHttpInterceptorRequestPath = string;

export type UnhandledHttpInterceptorRequestMethodSchema = HttpSchema.Method<{
  request: {
    headers: Record<string, string>;
    searchParams: Record<string, string | string[]>;
    body: HttpBody;
  };
}>;

/** @see {@link https://zimic.dev/docs/interceptor/guides/http/unhandled-requests Unhandled requests} */
export type UnhandledHttpInterceptorRequest = Omit<
  HttpInterceptorRequest<string, UnhandledHttpInterceptorRequestMethodSchema>,
  'response'
>;
