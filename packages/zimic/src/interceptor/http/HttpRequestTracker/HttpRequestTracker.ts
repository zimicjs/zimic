import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseFactory,
  InterceptedHttpRequest,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponse,
} from './types';

class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  private interceptedRequests: InterceptedHttpRequest<MethodSchema, StatusCode>[] = [];
  private responseOrCreateResponse?: HttpRequestTrackerResponseFactory<MethodSchema, StatusCode>;

  matchesRequest(_request: HttpInterceptorRequest<MethodSchema>): boolean {
    return this.responseOrCreateResponse !== undefined;
  }

  respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    responseOrCreateResponse: HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode> {
    const newThis = this as unknown as HttpRequestTracker<MethodSchema, StatusCode>;
    newThis.responseOrCreateResponse = this.isResponseFactory<StatusCode>(responseOrCreateResponse)
      ? responseOrCreateResponse
      : () => responseOrCreateResponse;
    return newThis;
  }

  async createResponse(
    request: HttpInterceptorRequest<MethodSchema>,
  ): Promise<HttpRequestTrackerResponse<MethodSchema, StatusCode>> {
    if (!this.responseOrCreateResponse) {
      throw new NoResponseDefinitionError();
    }

    const response = await this.responseOrCreateResponse(request);
    this.registerInterceptedRequest(request, response);
    return response;
  }

  private isResponseFactory<
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(
    declaration: HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>,
  ): declaration is HttpRequestTrackerResponseFactory<MethodSchema, StatusCode> {
    return typeof declaration === 'function';
  }

  private registerInterceptedRequest(
    request: HttpInterceptorRequest<MethodSchema>,
    response: HttpRequestTrackerResponse<MethodSchema, StatusCode>,
  ) {
    const interceptedRequest = new Proxy(request as unknown as InterceptedHttpRequest<MethodSchema, StatusCode>, {
      get(target, property, receiver) {
        if (property === 'response') {
          return response;
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    this.interceptedRequests.push(interceptedRequest);
  }

  requests(): readonly InterceptedHttpRequest<MethodSchema, StatusCode>[] {
    return this.interceptedRequests;
  }
}

export default HttpRequestTracker;
