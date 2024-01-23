import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import HttpRequestTracker from './HttpRequestTracker';
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
> extends HttpRequestTracker<MethodSchema, StatusCode> {
  protected createResponseDeclaration?: HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>;

  respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): InternalHttpRequestTracker<MethodSchema, StatusCode> {
    const newThis = this as unknown as InternalHttpRequestTracker<MethodSchema, StatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory<StatusCode>(declarationOrCreateDeclaration)
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
