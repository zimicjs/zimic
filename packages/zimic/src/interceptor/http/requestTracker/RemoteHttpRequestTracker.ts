import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import HttpInterceptor from '../interceptor/HttpInterceptor';
import {
  HttpRequestTrackerRestriction,
  PendingRemoteHttpRequestTracker,
  RemoteHttpRequestTracker as PublicRemoteHttpRequestTracker,
  SyncedRemoteHttpRequestTracker,
} from './types/public';
import {
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

class RemoteHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>
{
  readonly type = 'remote';

  constructor(
    private interceptor: HttpInterceptor<Schema>,
    private _method: Method,
    private _path: Path,
  ) {}

  method() {
    return this._method;
  }

  path() {
    return this._path;
  }

  with(
    _restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    return this;
  }

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    _declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode> {
    const newThis = this as unknown as RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode>;
    return newThis;
  }

  bypass(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    return this;
  }

  clear(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    return this.bypass();
  }

  requests(): Promise<readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[]> {
    return Promise.resolve([]);
  }

  then<FulfilledResult = SyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>, RejectedResult = never>(
    _onFulfilled?:
      | ((
          tracker: SyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    _onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    return Promise.resolve(undefined as never);
  }

  catch<RejectedResult = never>(
    _onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<SyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> | RejectedResult> {
    return Promise.resolve(undefined as never);
  }

  finally(
    _onFinally?: (() => void) | null,
  ): Promise<PendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>> {
    return Promise.resolve(undefined as never);
  }
}

export default RemoteHttpRequestTracker;
