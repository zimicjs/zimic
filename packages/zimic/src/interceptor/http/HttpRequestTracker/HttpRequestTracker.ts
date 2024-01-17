import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import { EffectiveHttpRequestHandlerResult } from '../HttpInterceptorWorker/types';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseFactory,
  InterceptedHttpRequest,
  HttpRequestTrackerResponseDeclaration,
} from './types';

class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  private responseDeclaration?: HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>;

  shouldRespondRequest(_request: HttpInterceptorRequest<MethodSchema>): boolean {
    return true;
  }

  respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declaration: HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode> {
    const newThis = this as unknown as HttpRequestTracker<MethodSchema, StatusCode>;
    newThis.responseDeclaration = declaration;
    return newThis;
  }

  async createResponse(request: HttpInterceptorRequest<MethodSchema>): Promise<EffectiveHttpRequestHandlerResult> {
    if (!this.responseDeclaration) {
      throw new NoResponseDefinitionError();
    }

    const responseBodyOrCreateResponseBody = this.responseDeclaration.body;

    const createResponseBody = this.isResponseFactory<StatusCode>(responseBodyOrCreateResponseBody)
      ? responseBodyOrCreateResponseBody
      : () => responseBodyOrCreateResponseBody;

    return {
      status: this.responseDeclaration.status,
      body: await createResponseBody(request),
    };
  }

  private isResponseFactory<
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(
    body: HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>['body'],
  ): body is HttpRequestTrackerResponseFactory<MethodSchema, StatusCode> {
    return typeof body === 'function';
  }

  requests: () => InterceptedHttpRequest<MethodSchema, StatusCode>[] = () => [];
}

export default HttpRequestTracker;
