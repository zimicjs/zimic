import { HttpSchema } from '@/http/types/schema';
import {
  HttpInterceptorWorkerPlatform,
  HttpInterceptorWorkerType,
} from '@/interceptor/http/interceptorWorker/types/options';
import { PossiblePromise } from '@/types/utils';
import { AccessResources } from '@tests/utils/workers';

export interface SharedHttpRequestTrackerTestOptions {
  platform: HttpInterceptorWorkerPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorWorkerType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}

export type HeadersSchema = HttpSchema.Headers<{
  accept?: string;
  'content-type'?: string;
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

export type Schema = HttpSchema.Paths<{
  '/users': {
    POST: MethodSchema;
  };
}>;
