import { HttpResponseSchemaStatusCode, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestHandlerClient from './HttpRequestHandlerClient';
import {
  HttpRequestHandlerRestriction,
  RemoteHttpRequestHandler as PublicRemoteHttpRequestHandler,
  SyncedRemoteHttpRequestHandler as PublicSyncedRemoteHttpRequestHandler,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './types/requests';

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> implements PublicRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>
{
  readonly type = 'remote';

  private _client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;

  private syncPromises: Promise<unknown>[] = [];

  private unsynced: this;
  private synced: this;

  constructor(interceptor: HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>, method: Method, path: Path) {
    this._client = new HttpRequestHandlerClient(interceptor, method, path, this);
    this.unsynced = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property: keyof RemoteHttpRequestHandler<Schema, Method, Path, StatusCode>) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property: keyof RemoteHttpRequestHandler<Schema, Method, Path, StatusCode>) => {
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
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ): RemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.with(restriction);
    return this.unsynced;
  }

  respond<NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    const newUnsyncedThis = this.unsynced as unknown as RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    newUnsyncedThis._client.respond(declaration);
    return newUnsyncedThis;
  }

  bypass(): RemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.bypass();
    return this.unsynced;
  }

  clear(): RemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
    this._client.clear();
    return this.unsynced;
  }

  requests(): Promise<readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[]> {
    return new Promise((resolve, reject) => {
      try {
        resolve(this._client.requests());
      } catch (error) {
        reject(error);
      }
    });
  }

  matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>): Promise<boolean> {
    return this._client.matchesRequest(request);
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this._client.applyResponseDeclaration(request);
  }

  registerInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this._client.saveInterceptedRequest(request, response);
  }

  registerSyncPromise(promise: Promise<unknown>) {
    this.syncPromises.push(promise);
  }

  isSynced(): boolean {
    return this.syncPromises.length === 0;
  }

  then<
    FulfilledResult = PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
    RejectedResult = never,
  >(
    onFulfilled?:
      | ((
          handler: PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRejected?: ((reason: any) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    const promisesToWait = new Set(this.syncPromises);

    return Promise.all(promisesToWait)
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncPromises = this.syncPromises.filter((promise) => !promisesToWait.has(promise));

        return this.isSynced() ? this.synced : this.unsynced;
      })
      .then(onFulfilled, onRejected);
  }

  catch<RejectedResult = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRejected?: ((reason: any) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(
    onFinally?: (() => void) | null,
  ): Promise<PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>> {
    return this.then().finally(onFinally);
  }
}

export default RemoteHttpRequestHandler;
