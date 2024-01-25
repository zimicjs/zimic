import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../../interceptor/types/schema';
import BaseHttpRequestTracker from '../BaseHttpRequestTracker';
import {
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './requests';

export interface HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  respond: <StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ) => BaseHttpRequestTracker<MethodSchema, StatusCode>;

  bypass: () => BaseHttpRequestTracker<MethodSchema, StatusCode>;

  requests: () => readonly TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[];
}
