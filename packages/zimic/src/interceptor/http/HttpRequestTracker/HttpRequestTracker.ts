import { Default } from '@/types/utils';

import { HttpInterceptorMethodSchema, HttpInterceptorResponseSchemaStatusCode } from '../HttpInterceptor/types/schema';
import NoResponseDefinitionError from './errors/NoResponseDefinitionError';
import {
  HttpInterceptorRequest,
  HttpRequestTrackerResponseDeclarationFactory,
  HttpRequestTrackerResponseDeclaration,
  HttpInterceptorResponse,
  TrackedHttpInterceptorRequest,
} from './types';

class HttpRequestTracker<
  MethodSchema extends HttpInterceptorMethodSchema,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>> = never,
> {
  private interceptedRequests: TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] = [];
  private createResponseDeclaration?: HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>;

  matchesRequest(_request: HttpInterceptorRequest<MethodSchema>): boolean {
    return this.createResponseDeclaration !== undefined;
  }

  respond<StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>>(
    declarationOrCreateDeclaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): HttpRequestTracker<MethodSchema, StatusCode> {
    const newThis = this as unknown as HttpRequestTracker<MethodSchema, StatusCode>;

    newThis.createResponseDeclaration = this.isResponseDeclarationFactory<StatusCode>(declarationOrCreateDeclaration)
      ? declarationOrCreateDeclaration
      : () => declarationOrCreateDeclaration;

    newThis.interceptedRequests = [];

    return newThis;
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

  private isResponseDeclarationFactory<
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<MethodSchema, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode>,
  ): declaration is HttpRequestTrackerResponseDeclarationFactory<MethodSchema, StatusCode> {
    return typeof declaration === 'function';
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<MethodSchema>,
    response: HttpInterceptorResponse<MethodSchema, StatusCode>,
  ) {
    const interceptedRequest = new Proxy(
      request as unknown as TrackedHttpInterceptorRequest<MethodSchema, StatusCode>,
      {
        get(target, property) {
          if (property === 'response') {
            return response satisfies TrackedHttpInterceptorRequest<MethodSchema, StatusCode>['response'];
          }
          return Reflect.get(target, property, target) as unknown;
        },
      },
    );

    this.interceptedRequests.push(interceptedRequest);
  }

  requests(): readonly TrackedHttpInterceptorRequest<MethodSchema, StatusCode>[] {
    return this.interceptedRequests;
  }
}

export default HttpRequestTracker;
