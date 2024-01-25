import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../interceptor/types/schema';
import { HttpRequestTracker } from './types/public';
import {
  HttpRequestTrackerResponseDeclarationFactory,
  HttpRequestTrackerResponseDeclaration,
  TrackedHttpInterceptorRequest,
} from './types/requests';

abstract class BaseHttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> implements HttpRequestTracker<MethodSchema, StatusCode>
{
  protected interceptedRequests: TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] = [];

  abstract respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): BaseHttpRequestTracker<MethodSchema, StatusCode>;

  abstract bypass(): BaseHttpRequestTracker<MethodSchema, StatusCode>;

  requests(): readonly TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] {
    return this.interceptedRequests;
  }
}

export default BaseHttpRequestTracker;
