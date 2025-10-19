import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpStatusCode } from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import HttpRequestHandlerClient from './HttpRequestHandlerClient';
import {
  InternalHttpRequestHandler,
  SyncedRemoteHttpRequestHandler as PublicSyncedRemoteHttpRequestHandler,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  InterceptedHttpInterceptorRequest,
} from './types/requests';
import { HttpRequestHandlerRestriction } from './types/restrictions';

const PENDING_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> implements InternalHttpRequestHandler<Schema, Method, Path, StatusCode>
{
  readonly type = 'remote';

  client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;

  private syncPromises: Promise<unknown>[] = [];

  private unsynced: this;
  private synced: this;

  constructor(interceptor: HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>, method: Method, path: Path) {
    this.client = new HttpRequestHandlerClient(interceptor, method, path, this);
    this.unsynced = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property) => {
        if (this.isHiddenPropertyWhenSynced(property)) {
          return undefined;
        }
        return Reflect.get(target, property);
      },
    });
  }

  private isHiddenPropertyWhenSynced(property: string | symbol) {
    return PENDING_PROPERTIES.has(property);
  }

  get method() {
    return this.client.method;
  }

  get path() {
    return this.client.path;
  }

  with(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>): this {
    this.client.with(restriction);
    return this.unsynced;
  }

  respond<NewStatusCode extends HttpStatusCode>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    const newUnsyncedThis = this.unsynced as unknown as RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    newUnsyncedThis.client.respond(declaration);
    return newUnsyncedThis;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number): this {
    this.client.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  async checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.client.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clear(): this {
    this.client.clear();
    return this.unsynced;
  }

  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    return this.client.requests;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    const requestMatch = await this.client.matchesRequest(request);

    if (requestMatch.success) {
      this.client.markRequestAsMatched(request);
    } else if (requestMatch.cause === 'unmatchedRestrictions') {
      this.client.markRequestAsUnmatched(request, { diff: requestMatch.diff });
    } else {
      this.client.markRequestAsMatched(request);
    }

    return requestMatch;
  }

  async applyResponseDeclaration(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
  ): Promise<HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>> {
    return this.client.applyResponseDeclaration(request);
  }

  saveInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this.client.saveInterceptedRequest(request, response);
  }

  registerSyncPromise(promise: Promise<unknown>) {
    this.syncPromises.push(promise);
  }

  get isSynced() {
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
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<FulfilledResult | RejectedResult> {
    const promisesToWait = new Set(this.syncPromises);

    return Promise.all(promisesToWait)
      .then(() => {
        this.syncPromises = this.syncPromises.filter((promise) => !promisesToWait.has(promise));

        return this.isSynced ? this.synced : this.unsynced;
      })
      .then(onFulfilled, onRejected);
  }

  catch<RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ): Promise<PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult> {
    return this.then().catch(onRejected);
  }

  finally(
    onFinally?: (() => void) | null,
  ): Promise<PublicSyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>> {
    return this.then().finally(onFinally);
  }
}

export type AnyRemoteHttpRequestHandler =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | RemoteHttpRequestHandler<any, any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | RemoteHttpRequestHandler<any, any, any, any>;

export default RemoteHttpRequestHandler;
