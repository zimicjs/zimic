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

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>
{
  readonly type = 'remote';

  private _client: HttpRequestTrackerClient<Schema, Method, Path, StatusCode>;

  private syncPromises: Promise<unknown>[] = [];

  private unsynced: this;
  private synced: this;

  constructor(interceptor: HttpInterceptorClient<Schema, typeof RemoteHttpRequestTracker>, method: Method, path: Path) {
    this._client = new HttpRequestTrackerClient(interceptor, method, path);
    this.unsynced = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property: keyof RemoteHttpRequestTracker<Schema, Method, Path, StatusCode>) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property: keyof RemoteHttpRequestTracker<Schema, Method, Path, StatusCode>) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return undefined;
        }
        return Reflect.get(target, property);
      },
    });
  }

  private isHiddenPropertyWhenSynced(property: string) {
    return PENDING_PROPERTIES.has(property);
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
    return this.unsynced;
  }

  respond<
    NewStatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode> {
    const newUnsyncedThis = this.unsynced as unknown as RemoteHttpRequestTracker<Schema, Method, Path, NewStatusCode>;
    newUnsyncedThis._client.respond(declaration);
    return newUnsyncedThis;
  }

  bypass(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.bypass();
    return this.unsynced;
  }

  clear(): RemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
    this._client.clear();
    return this.unsynced;
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
    const promisesToWait = new Set(this.syncPromises);

    return Promise.all(promisesToWait)
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncPromises = this.syncPromises.filter((promise) => !promisesToWait.has(promise));

        return this.syncPromises.length === 0 ? this.synced : this.unsynced;
      })
      .then(onFulfilled, onRejected);
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
        return this.synced;
      },
      (_error) => {
        onFinally?.();
        return this.synced;
      },
    );
  }
}

export default RemoteHttpRequestTracker;
