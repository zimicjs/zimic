import { HttpSchema } from '@/http/types/schema';
import { HttpInterceptorPlatform, HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/urls';

export interface SharedHttpRequestHandlerTestOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<ExtendedURL>;
}

export type HeadersSchema = HttpSchema.Headers<{
  accept?: string;
  'content-language'?: string;
}>;

export type SearchParamsSchema = HttpSchema.SearchParams<{
  name?: string;
  other?: string;
}>;

export type MethodSchema = HttpSchema.Method<{
  request: {
    headers: HeadersSchema;
    searchParams: SearchParamsSchema;
    body: {
      name?: string;
      value?: number[];
    };
  };
  response: {
    200: {
      body: { success: true };
    };
  };
}>;

export type Schema = HttpSchema<{
  '/users': {
    POST: MethodSchema;
  };
}>;
