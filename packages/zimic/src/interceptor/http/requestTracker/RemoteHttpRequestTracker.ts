import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestTrackerClient from './HttpRequestTrackerClient';
import {
  HttpRequestTrackerRestriction,
  PublicRemoteHttpRequestTracker,
  PublicSyncedRemoteHttpRequestTracker,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class RemoteHttpRequestTracker<
    Schema extends HttpServiceSchema,
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
  >
  extends Promise<unknown>
  implements PublicRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>
{
  readonly type = 'remote';

  private _client: HttpRequestTrackerClient<Schema, Method, Path, StatusCode>;
  private syncPromises: Promise<unknown>[] = [];

  constructor(interceptor: HttpInterceptorClient<Schema, typeof RemoteHttpRequestTracker>, method: Method, path: Path) {
    super(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
    this._client = new HttpRequestTrackerClient(interceptor, method, path);
  }

  client() {
    return this._client;
  }

  method() {
    return this._client.method();
  }

  path() {
    return this._client.path();
  }

  with(
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.with(restriction);
    return this;
  }

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode> {
    const newThis = this as unknown as RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode>;
    newThis._client.respond(declaration);
    return newThis;
  }

  bypass(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.bypass();
    return this;
  }

  clear(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.clear();
    return this;
  }

  requests(): Promise<readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[]> {
    return Promise.resolve(this._client.requests());
  }

  matchesRequest(request: HttpInterceptorRequest<Default<Schema[Path][Method]>>): boolean {
    return this._client.matchesRequest(request);
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this._client.applyResponseDeclaration(request);
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this._client.registerInterceptedRequest(request, response);
  }

  registerSyncPromise(promise: Promise<unknown>) {
    this.syncPromises.push(promise);
  }

  then<
    FulfilledResult = PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
    RejectedResult = never,
  >(
    onFulfilled?:
      | ((
          tracker: PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    return Promise.all(this.syncPromises).then(() => {
      this.syncPromises = [];

      if (onFulfilled) {
        return onFulfilled(this);
      } else {
        return this as unknown as FulfilledResult;
      }
    }, onRejected);
  }

  catch<RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> | RejectedResult> {
    return this.then(null, onRejected);
  }

  finally(
    onFinally?: (() => void) | null,
  ): Promise<PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>> {
    return this.then(
      (_tracker) => {
        onFinally?.();
        return this;
      },
      (_error) => {
        onFinally?.();
        return this;
      },
    );
  }
}

export default RemoteHttpRequestTracker;
