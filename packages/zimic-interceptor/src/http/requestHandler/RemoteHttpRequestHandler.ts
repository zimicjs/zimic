import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpStatusCode } from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import HttpInterceptorImplementation from '../interceptor/HttpInterceptorImplementation';
import HttpRequestHandlerImplementation from './HttpRequestHandlerImplementation';
import {
  InternalHttpRequestHandler,
  SyncedRemoteHttpRequestHandler as PublicSyncedRemoteHttpRequestHandler,
} from './types/public';
import {
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDelayFactory,
  InterceptedHttpInterceptorRequest,
} from './types/requests';
import { HttpRequestHandlerRestriction } from './types/restrictions';

const UNSYNCED_PROPERTIES = new Set<string | symbol>(['then'] satisfies (keyof Promise<unknown>)[]);

class RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> implements InternalHttpRequestHandler<Schema, Method, Path, StatusCode> {
  readonly type = 'remote';

  implementation: HttpRequestHandlerImplementation<Schema, Method, Path, StatusCode>;

  private syncPromises: Promise<unknown>[] = [];

  private pending: this;
  private synced: this;

  constructor(
    interceptor: HttpInterceptorImplementation<Schema, typeof RemoteHttpRequestHandler>,
    method: Method,
    path: Path,
  ) {
    this.implementation = new HttpRequestHandlerImplementation(interceptor, method, path, this);
    this.pending = this;
    this.synced = this.createSyncedProxy();
  }

  private createSyncedProxy() {
    return new Proxy(this, {
      has: (target, property) => {
        if (this.shouldBeHiddenPropertyWhenSynced(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get: (target, property) => {
        if (this.shouldBeHiddenPropertyWhenSynced(property)) {
          return undefined;
        }
        return Reflect.get(target, property);
      },
    });
  }

  private shouldBeHiddenPropertyWhenSynced(property: string | symbol) {
    return UNSYNCED_PROPERTIES.has(property);
  }

  get method() {
    return this.implementation.method;
  }

  get path() {
    return this.implementation.path;
  }

  with(restriction: HttpRequestHandlerRestriction<Schema, Method, Path>) {
    this.implementation.with(restriction);
    return this.pending;
  }

  delay(
    minMilliseconds: number | HttpRequestHandlerResponseDelayFactory<Path, Default<Schema[Path][Method]>>,
    maxMilliseconds?: number,
  ) {
    this.implementation.delay(minMilliseconds, maxMilliseconds);
    return this.pending;
  }

  respond<NewStatusCode extends HttpStatusCode>(
    declaration: HttpRequestHandlerResponseDeclaration<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ): RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode> {
    const newUnsyncedThis = this.pending as unknown as RemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode>;
    newUnsyncedThis.implementation.respond(declaration);
    return newUnsyncedThis;
  }

  times(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    this.implementation.times(minNumberOfRequests, maxNumberOfRequests);
    return this;
  }

  async checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.implementation.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clear() {
    this.implementation.clear();
    return this.pending;
  }

  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[] {
    return this.implementation.requests;
  }

  async matchesRequest(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    const requestMatch = await this.implementation.matchesRequest(request);

    if (requestMatch.success) {
      this.implementation.markRequestAsMatched(request);
    } else if (requestMatch.cause === 'unmatchedRestrictions') {
      this.implementation.markRequestAsUnmatched(request, { diff: requestMatch.diff });
    } else {
      this.implementation.markRequestAsMatched(request);
    }

    return requestMatch;
  }

  async applyResponseDeclaration(request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) {
    return this.implementation.applyResponseDeclaration(request);
  }

  saveInterceptedRequest(
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    response: HttpInterceptorResponse<Default<Schema[Path][Method]>, StatusCode>,
  ) {
    this.implementation.saveInterceptedRequest(request, response);
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

        return this.isSynced ? this.synced : this.pending;
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
