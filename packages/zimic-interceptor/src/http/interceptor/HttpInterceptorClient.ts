import {
  HttpResponse,
  HTTP_METHODS,
  HttpMethod,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
  HttpSchema,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';
import createRegExpFromURL from '@zimic/utils/url/createRegExpFromURL';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import joinURL from '@zimic/utils/url/joinURL';
import validateURLProtocol from '@zimic/utils/url/validateURLProtocol';

import { isServerSide } from '@/utils/environment';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import HttpRequestHandlerClient, { AnyHttpRequestHandlerClient } from '../requestHandler/HttpRequestHandlerClient';
import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import { HttpRequestHandler, InternalHttpRequestHandler } from '../requestHandler/types/public';
import { HttpInterceptorRequest } from '../requestHandler/types/requests';
import NotRunningHttpInterceptorError from './errors/NotRunningHttpInterceptorError';
import RequestSavingSafeLimitExceededError from './errors/RequestSavingSafeLimitExceededError';
import RunningHttpInterceptorError from './errors/RunningHttpInterceptorError';
import HttpInterceptorStore from './HttpInterceptorStore';
import { UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestSaving } from './types/public';
import { HttpInterceptorRequestContext } from './types/requests';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['http', 'https']);

export const DEFAULT_REQUEST_SAVING_SAFE_LIMIT = 1000;

class HttpInterceptorClient<
  Schema extends HttpSchema,
  HandlerConstructor extends HttpRequestHandlerConstructor = HttpRequestHandlerConstructor,
> {
  private store: HttpInterceptorStore;
  private _baseURL!: URL;

  private getOrCreateWorker: () => HttpInterceptorWorker;
  private removeWorker: () => void;
  private worker?: HttpInterceptorWorker;

  requestSaving: HttpInterceptorRequestSaving;
  private numberOfSavedRequests = 0;

  onUnhandledRequest?: HandlerConstructor extends typeof LocalHttpRequestHandler
    ? UnhandledRequestStrategy.Local
    : UnhandledRequestStrategy.Remote;

  isRunning = false;

  private Handler: HandlerConstructor;

  private handlerClientsByMethod: {
    [Method in HttpMethod]: Map<string, AnyHttpRequestHandlerClient[]>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: {
    store: HttpInterceptorStore;
    baseURL: URL;
    getOrCreateWorker: () => HttpInterceptorWorker;
    removeWorker: () => void;
    requestSaving?: Partial<HttpInterceptorRequestSaving>;
    onUnhandledRequest?: UnhandledRequestStrategy;
    Handler: HandlerConstructor;
  }) {
    this.store = options.store;
    this.baseURL = options.baseURL;

    this.getOrCreateWorker = options.getOrCreateWorker;
    this.removeWorker = options.removeWorker;

    this.requestSaving = {
      enabled: options.requestSaving?.enabled ?? this.getDefaultRequestSavingEnabled(),
      safeLimit: options.requestSaving?.safeLimit ?? DEFAULT_REQUEST_SAVING_SAFE_LIMIT,
    };

    this.onUnhandledRequest = options.onUnhandledRequest satisfies
      | UnhandledRequestStrategy
      | undefined as this['onUnhandledRequest'];

    this.Handler = options.Handler;
  }

  private getDefaultRequestSavingEnabled(): boolean {
    return isServerSide() ? process.env.NODE_ENV === 'test' : false;
  }

  get baseURL() {
    return this._baseURL;
  }

  set baseURL(newBaseURL: URL) {
    if (this.isRunning) {
      throw new RunningHttpInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the base URL?',
      );
    }

    validateURLProtocol(newBaseURL, SUPPORTED_BASE_URL_PROTOCOLS);
    excludeURLParams(newBaseURL);

    this._baseURL = newBaseURL;
  }

  get baseURLAsString() {
    if (this.baseURL.href === `${this.baseURL.origin}/`) {
      return this.baseURL.origin;
    }
    return this.baseURL.href;
  }

  private get workerOrThrow() {
    if (!this.worker) {
      throw new NotRunningHttpInterceptorError();
    }
    return this.worker;
  }

  get platform() {
    return this.worker?.platform ?? null;
  }

  async start() {
    try {
      this.worker = this.getOrCreateWorker();

      await this.worker.start();
      this.worker.registerRunningInterceptor(this);
      this.markAsRunning(true);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    this.worker?.unregisterRunningInterceptor(this);

    // The number of interceptors will be 0 if the first client could not start due to an error.
    const isLastRunningInterceptor = this.numberOfRunningInterceptors === 0 || this.numberOfRunningInterceptors === 1;

    if (isLastRunningInterceptor) {
      await this.worker?.stop();
      this.removeWorker();
    }

    this.markAsRunning(false);
  }

  private markAsRunning(isRunning: boolean) {
    if (this.worker?.type === 'local') {
      this.store.markLocalInterceptorAsRunning(this, isRunning);
    } else if (this.worker?.type === 'remote') {
      this.store.markRemoteInterceptorAsRunning(this, isRunning, this.baseURL);
    }
    this.isRunning = isRunning;
  }

  get numberOfRunningInterceptors() {
    if (!this.isRunning) {
      return 0;
    }

    if (this.workerOrThrow.type === 'local') {
      return this.store.numberOfRunningLocalInterceptors;
    } else {
      return this.store.numberOfRunningRemoteInterceptors(this.baseURL);
    }
  }

  get(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('GET' as HttpSchemaMethod<Schema>, path);
  }

  post(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('POST' as HttpSchemaMethod<Schema>, path);
  }

  patch(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('PATCH' as HttpSchemaMethod<Schema>, path);
  }

  put(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('PUT' as HttpSchemaMethod<Schema>, path);
  }

  delete(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('DELETE' as HttpSchemaMethod<Schema>, path);
  }

  head(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('HEAD' as HttpSchemaMethod<Schema>, path);
  }

  options(path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('OPTIONS' as HttpSchemaMethod<Schema>, path);
  }

  private createHttpRequestHandler<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
  >(method: Method, path: Path): HttpRequestHandler<Schema, Method, Path> {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    const handler = new this.Handler<Schema, Method, Path>(this as SharedHttpInterceptorClient<Schema>, method, path);
    this.registerRequestHandler(handler);

    return handler;
  }

  registerRequestHandler<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    StatusCode extends HttpStatusCode = never,
  >(handler: InternalHttpRequestHandler<Schema, Method, Path, StatusCode>) {
    const handlerClients = this.handlerClientsByMethod[handler.method].get(handler.path) ?? [];

    const isAlreadyRegistered = handlerClients.includes(handler.client);
    if (isAlreadyRegistered) {
      return;
    }

    handlerClients.push(handler.client);

    const isFirstHandlerForMethodPath = handlerClients.length === 1;
    if (!isFirstHandlerForMethodPath) {
      return;
    }

    this.handlerClientsByMethod[handler.method].set(handler.path, handlerClients);

    const url = joinURL(this.baseURLAsString, handler.path);
    const urlRegex = createRegExpFromURL(url);

    const registrationResult = this.workerOrThrow.use(this, handler.method, url, async (context) => {
      const response = await this.handleInterceptedRequest(
        urlRegex,
        handler.method,
        handler.path,
        context as HttpInterceptorRequestContext<Schema, Method, Path>,
      );
      return response;
    });

    if (handler instanceof RemoteHttpRequestHandler && registrationResult instanceof Promise) {
      handler.registerSyncPromise(registrationResult);
    }
  }

  private async handleInterceptedRequest<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(matchedURLRegex: RegExp, method: Method, path: Path, { request }: Context): Promise<HttpResponse | null> {
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<Path, Default<Schema[Path][Method]>>(request, {
      urlRegex: matchedURLRegex,
    });

    const matchedHandler = await this.findMatchedHandler(method, path, parsedRequest);

    if (!matchedHandler) {
      return null;
    }

    const responseDeclaration = await matchedHandler.applyResponseDeclaration(parsedRequest);
    const response = HttpInterceptorWorker.createResponseFromDeclaration(request, responseDeclaration);

    if (this.requestSaving.enabled) {
      const responseClone = response.clone();

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(responseClone);

      matchedHandler.saveInterceptedRequest(parsedRequest, parsedResponse);
    }

    return response;
  }

  incrementNumberOfSavedRequests(increment: number) {
    this.numberOfSavedRequests = Math.max(this.numberOfSavedRequests + increment, 0);

    const exceedsSafeLimit = this.numberOfSavedRequests > this.requestSaving.safeLimit;

    if (increment > 0 && exceedsSafeLimit) {
      const error = new RequestSavingSafeLimitExceededError(this.numberOfSavedRequests, this.requestSaving.safeLimit);
      console.warn(error);
    }
  }

  private async findMatchedHandler<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
  >(
    method: Method,
    path: Path,
    parsedRequest: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<HttpRequestHandlerClient<Schema, Method, Path, any> | undefined> {
    /* istanbul ignore next -- @preserve
     * Ignoring because there will always be a handler for the given method and path at this point. */
    const handlersByPath = this.handlerClientsByMethod[method].get(path) ?? [];

    for (let handlerIndex = handlersByPath.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = handlersByPath[handlerIndex];
      if (await handler.matchesRequest(parsedRequest)) {
        return handler;
      }
    }

    return undefined;
  }

  checkTimes() {
    for (const method of HTTP_METHODS) {
      const handlersByPath = this.handlerClientsByMethod[method];

      for (const handlers of handlersByPath.values()) {
        for (const handler of handlers) {
          handler.checkTimes();
        }
      }
    }
  }

  clear(options: { onCommitSuccess?: () => void; onCommitError?: () => void } = {}) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient | void>[] = [];

    for (const method of HTTP_METHODS) {
      const newClearResults = this.clearMethodHandlers(method);

      for (const result of newClearResults) {
        clearResults.push(result);
      }

      const handlersByPath = this.handlerClientsByMethod[method];
      handlersByPath.clear();
    }

    const clearResult = this.workerOrThrow.clearInterceptorHandlers(this);
    clearResults.push(clearResult);

    if (options.onCommitSuccess) {
      void Promise.all(clearResults).then(options.onCommitSuccess, options.onCommitError);
    }
  }

  private clearMethodHandlers(method: HttpMethod) {
    const handlersByPath = this.handlerClientsByMethod[method];
    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient>[] = [];

    for (const handlers of handlersByPath.values()) {
      for (const handler of handlers) {
        clearResults.push(handler.clear());
      }
    }

    return clearResults;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpInterceptorClient = HttpInterceptorClient<any>;

export type HttpRequestHandlerConstructor = typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

export type SharedHttpInterceptorClient<Schema extends HttpSchema> = HttpInterceptorClient<
  Schema,
  typeof LocalHttpRequestHandler
> &
  HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>;

export default HttpInterceptorClient;
