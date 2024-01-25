import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../interceptor/types/schema';
import BaseHttpRequestTracker from './BaseHttpRequestTracker';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class InternalHttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> extends BaseHttpRequestTracker<MethodSchema, StatusCode> {
  protected createResponseDeclaration?: HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>;

  respond<NewStatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, NewStatusCode>,
  ): InternalHttpRequestTracker<MethodSchema, NewStatusCode> {
    const newThis = this as unknown as InternalHttpRequestTracker<MethodSchema, NewStatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory<NewStatusCode>(declarationOrCreateDeclaration)
      ? declarationOrCreateDeclaration
      : () => declarationOrCreateDeclaration;

    newThis.interceptedRequests = [];

    return newThis;
  }

  private isResponseDeclarationFactory<
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): declaration is HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode> {
    return typeof declaration === 'function';
  }

  bypass(): BaseHttpRequestTracker<MethodSchema, StatusCode> {
    this.createResponseDeclaration = undefined;
    this.interceptedRequests = [];
    return this;
  }

  matchesRequest(_request: HttpInterceptorRequest<MethodSchema>): boolean {
    return this.createResponseDeclaration !== undefined;
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<MethodSchema>,
  ): Promise<HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>> {
    if (!this.createResponseDeclaration) {
      throw new NoResponseDefinitionError();
    }
    const appliedDeclaration = await this.createResponseDeclaration(request);
    return appliedDeclaration;
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<MethodSchema>,
    response: HttpInterceptorResponse<MethodSchema, StatusCode>,
  ) {
    const interceptedRequest = this.createInterceptedRequestProxy(request, response);
    this.interceptedRequests.push(interceptedRequest);
  }

  private createInterceptedRequestProxy(
    request: HttpInterceptorRequest<MethodSchema>,
    response: HttpInterceptorResponse<MethodSchema, StatusCode>,
  ) {
    return new Proxy(request as unknown as TrackedHttpInterceptorRequest<MethodSchema, StatusCode>, {
      get(target, property) {
        if (property === 'response') {
          return response satisfies TrackedHttpInterceptorRequest<MethodSchema, StatusCode>['response'];
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });
  }
}

export default InternalHttpRequestTracker;
