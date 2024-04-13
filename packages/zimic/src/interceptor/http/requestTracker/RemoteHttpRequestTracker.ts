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
  PublicPendingRemoteHttpRequestTracker,
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

  constructor(interceptor: HttpInterceptorClient<Schema>, method: Method, path: Path) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    super(() => {});
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
    this._client.respond(declaration);

    const newThis = this as unknown as RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode>;
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

  then<
    FulfilledResult = PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
    RejectedResult = never,
  >(
    _onFulfilled?:
      | ((
          tracker: PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    _onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    return Promise.resolve(undefined as never);
  }

  catch<RejectedResult = never>(
    _onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> | RejectedResult> {
    return Promise.resolve(undefined as never);
  }

  finally(
    _onFinally?: (() => void) | null,
  ): Promise<PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>> {
    return Promise.resolve(undefined as never);
  }
}

export default RemoteHttpRequestTracker;
