import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import {
  HttpRequestTrackerResponseDeclarationFactory,
  HttpRequestTrackerResponseDeclaration,
  TrackedHttpInterceptorRequest,
} from './types/requests';

abstract class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  protected interceptedRequests: TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] = [];

  abstract respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode>;

  abstract bypass(): HttpRequestTracker<MethodSchema, StatusCode>;

  requests(): readonly TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] {
    return this.interceptedRequests;
  }
}

export default HttpRequestTracker;
