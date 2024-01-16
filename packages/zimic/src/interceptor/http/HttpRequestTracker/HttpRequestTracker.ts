import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import { EffectiveHttpRequestHandlerResult } from '../HttpInterceptorWorker/types';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerComputeResponseFactory,
  HttpRequestTrackerResponse,
  InterceptedRequest,
} from './types';

class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  private computeResponse?: HttpRequestTrackerComputeResponseFactory<MethodSchema, StatusCode>;

  matchesRequest(_request: HttpInterceptorRequest<Default<MethodSchema['request']>>) {
    return true;
  }

  respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    responseOrComputeResponse:
      | HttpRequestTrackerResponse<Default<MethodSchema['response']>, StatusCode>
      | HttpRequestTrackerComputeResponseFactory<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode> {
    const newThis = this as unknown as HttpRequestTracker<MethodSchema, StatusCode>;

    if (typeof responseOrComputeResponse === 'function') {
      newThis.computeResponse = responseOrComputeResponse;
    } else {
      newThis.computeResponse = () => responseOrComputeResponse;
    }

    return newThis;
  }

  async createResponseResult(
    request: HttpInterceptorRequest<Default<MethodSchema['request']>>,
  ): Promise<EffectiveHttpRequestHandlerResult> {
    if (!this.computeResponse) {
      throw new Error('Cannot generate a response without a definition. Use .respond() to set a response.');
    }
    const response = await this.computeResponse(request);
    return response;
  }

  requests: () => InterceptedRequest<MethodSchema, StatusCode>[] = () => [];
}

export default HttpRequestTracker;
