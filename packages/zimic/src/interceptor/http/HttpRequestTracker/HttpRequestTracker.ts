import { Default } from '@/types/utils';

import { HttpInterceptorContext } from '../HttpInterceptor/types/options';
import {
  HttpInterceptorMethod,
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../HttpInterceptor/types/schema';
import { HttpRequestTrackerResponseDefinitionHandler, InterceptedRequest } from './types';

class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  constructor(
    private context: HttpInterceptorContext,
    private method: HttpInterceptorMethod,
    private path: string,
  ) {
    const lowercaseMethod = this.method.toLowerCase<typeof this.method>();
    this.context.worker.use(lowercaseMethod, this.path, () => {
      // TODO
    });
  }

  respond: HttpRequestTrackerResponseDefinitionHandler<MethodSchema> = () => {
    return this;
  };

  requests: () => InterceptedRequest<MethodSchema, StatusCode>[] = () => [];
}

export default HttpRequestTracker;
