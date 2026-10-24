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

export type UnhandledHttpInterceptorRequest = Omit<
  HttpInterceptorRequest<string, UnhandledHttpInterceptorRequestMethodSchema>,
  'response'
>;
