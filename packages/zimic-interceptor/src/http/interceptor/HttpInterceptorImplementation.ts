import {
  HttpRequest,
  HttpResponse,
  HTTP_METHODS,
  HttpMethod,
  HttpMethodSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
  HttpSchema,
} from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';

import { isServerSide } from '@/utils/environment';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import { AnyHttpRequestHandlerImplementation } from '../requestHandler/HttpRequestHandlerImplementation';
import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import { HttpRequestHandler, InternalHttpRequestHandler } from '../requestHandler/types/public';
import { HttpInterceptorRequest } from '../requestHandler/types/requests';
import NotRunningHttpInterceptorError from './errors/NotRunningHttpInterceptorError';
import RequestSavingSafeLimitExceededError from './errors/RequestSavingSafeLimitExceededError';
import RunningHttpInterceptorError from './errors/RunningHttpInterceptorError';
import type HttpInterceptorStore from './HttpInterceptorStore';
import { UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestSaving } from './types/public';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['http', 'https']);

export const DEFAULT_REQUEST_SAVING_SAFE_LIMIT = 1000;

export type HttpRequestHandlerConstructor = typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

class HttpInterceptorImplementation<
  Schema extends HttpSchema,
  HandlerConstructor extends HttpRequestHandlerConstructor = HttpRequestHandlerConstructor,
> {
  private store: HttpInterceptorStore;
  #baseURL!: URL;

  private createWorker: () => HttpInterceptorWorker;
  private deleteWorker: () => void;
  private worker?: HttpInterceptorWorker;

  private startPromise?: Promise<void>;
  private numberOfPendingStarts = 0;
  private numberOfPendingStops = 0;
  private lifecycleQueue: Promise<void> = Promise.resolve();

  requestSaving: HttpInterceptorRequestSaving;
  private numberOfSavedRequests = 0;
  private requestSavingGeneration = 0;

  onUnhandledRequest?: HandlerConstructor extends typeof LocalHttpRequestHandler
    ? UnhandledRequestStrategy.Local
    : UnhandledRequestStrategy.Remote;

  isRunning = false;

  private Handler: HandlerConstructor;

  private handlers: {
    [Method in HttpMethod]: Map<string, AnyHttpRequestHandlerImplementation[]>;
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
    createWorker: () => HttpInterceptorWorker;
    deleteWorker: () => void;
    requestSaving?: Partial<HttpInterceptorRequestSaving>;
    onUnhandledRequest?: UnhandledRequestStrategy;
    Handler: HandlerConstructor;
  }) {
    this.store = options.store;
    this.baseURL = options.baseURL;

    this.createWorker = options.createWorker;
    this.deleteWorker = options.deleteWorker;

    this.requestSaving = {
      enabled: options.requestSaving?.enabled ?? this.getDefaultRequestSavingEnabled(),
      safeLimit: options.requestSaving?.safeLimit ?? DEFAULT_REQUEST_SAVING_SAFE_LIMIT,
    };

    this.onUnhandledRequest = options.onUnhandledRequest satisfies
      UnhandledRequestStrategy | undefined as this['onUnhandledRequest'];

    this.Handler = options.Handler;
  }

  private getDefaultRequestSavingEnabled(): boolean {
    return isServerSide() ? process.env.NODE_ENV === 'test' : false;
  }

  get baseURL() {
    return this.#baseURL;
  }

  set baseURL(newBaseURL: URL) {
    if (this.isRunning || this.isStarting) {
      throw new RunningHttpInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the base URL?',
      );
    }

    validateURLProtocol(newBaseURL, SUPPORTED_BASE_URL_PROTOCOLS);
    excludeNonPathParams(newBaseURL);

    this.#baseURL = newBaseURL;
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

  start() {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.numberOfPendingStarts++;

    const startPromise = this.enqueueLifecycleOperation(() => this.startOnce()).finally(() => {
      this.numberOfPendingStarts--;

      const isLastStartPromise = this.startPromise === startPromise;

      if (isLastStartPromise) {
        this.startPromise = undefined;
      }
    });

    this.startPromise = startPromise;

    return startPromise;
  }

  private async startOnce() {
    if (this.isRunning) {
      return;
    }

    try {
      this.worker = this.createWorker();
      await this.worker.registerRunningInterceptor(this);

      await this.worker.start();

      this.markAsRunning(true);
    } catch (error) {
      await this.stopWorker();
      throw error;
    }
  }

  get isStarting() {
    return this.numberOfPendingStarts > 0;
  }

  // Handlers declared while stopping would survive the clear before the interceptor unregisters, so declarations are
  // rejected from the moment stop is called until it completes.
  get isStopping() {
    return this.numberOfPendingStops > 0;
  }

  async stop(options: { beforeStop?: () => PossiblePromise<void> }) {
    this.startPromise = undefined;
    this.numberOfPendingStops++;

    await this.enqueueLifecycleOperation(async () => {
      try {
        await this.stopOnce(options);
      } finally {
        this.numberOfPendingStops--;
      }
    });
  }

  private async stopOnce(options: { beforeStop?: () => PossiblePromise<void> }) {
    if (!this.isRunning) {
      return;
    }

    await options.beforeStop?.();

    await this.stopWorker();
  }

  private async stopWorker() {
    await this.worker?.unregisterRunningInterceptor(this);

    const isLastRunningInterceptor = this.worker?.numberOfRunningInterceptors === 0;

    if (isLastRunningInterceptor) {
      await this.worker?.stop();

      // Stopping is asynchronous, so we need to check again if we are still the last before deleting the worker.
      // Another interceptor might have started in the meantime and the worker should not be deleted if so.
      const isStillLastRunningInterceptor = this.worker?.numberOfRunningInterceptors === 0;

      if (isStillLastRunningInterceptor) {
        this.deleteWorker();
      }
    }

    this.markAsRunning(false);
    this.worker = undefined;
  }

  private enqueueLifecycleOperation(operation: () => Promise<void>) {
    const operationPromise = this.lifecycleQueue.then(operation);

    this.lifecycleQueue = operationPromise
      // Ensure the queue continues even if the operation fails
      .catch(() => undefined);

    return operationPromise;
  }

  private markAsRunning(isRunning: boolean) {
    if (this.workerOrThrow.type === 'local') {
      this.store.markLocalInterceptorAsRunning(this, isRunning);
    } else {
      this.store.markRemoteInterceptorAsRunning(this, isRunning, this.baseURL);
    }
    this.isRunning = isRunning;
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
    const handler = new this.Handler<Schema, Method, Path>(
      this as SharedHttpInterceptorImplementation<Schema>,
      method,
      path,
    );
    this.registerRequestHandler(handler);

    return handler;
  }

  registerRequestHandler<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    StatusCode extends HttpStatusCode = never,
  >(handler: InternalHttpRequestHandler<Schema, Method, Path, StatusCode>) {
    if (!this.isRunning || this.isStopping) {
      throw new NotRunningHttpInterceptorError();
    }

    const pathHandlers = this.handlers[handler.method].get(handler.path) ?? [];

    const isAlreadyRegistered = pathHandlers.includes(handler.implementation);

    if (isAlreadyRegistered) {
      return;
    }

    pathHandlers.push(handler.implementation);
    this.handlers[handler.method].set(handler.path, pathHandlers);

    this.workerOrThrow.use(this, handler.implementation);
  }

  async handleMatchedRequest(
    handler: AnyHttpRequestHandlerImplementation,
    request: HttpRequest,
    parsedRequest: HttpInterceptorRequest<string, HttpMethodSchema>,
  ): Promise<HttpResponse | null> {
    const requestSavingGeneration = this.requestSavingGeneration;

    const responseDeclaration = await handler.applyResponseDeclaration(parsedRequest);

    if (!responseDeclaration) {
      return null;
    }

    const response = await this.workerOrThrow.createResponseFromDeclaration(request, responseDeclaration);

    const shouldSaveInterceptedRequest =
      this.requestSaving.enabled &&
      requestSavingGeneration === this.requestSavingGeneration &&
      response &&
      !HttpInterceptorWorker.isRejectedResponse(response);

    if (shouldSaveInterceptedRequest) {
      const responseClone = response.clone();

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<HttpMethodSchema>(responseClone);

      handler.saveInterceptedRequest(parsedRequest, parsedResponse);
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

  checkTimes() {
    for (const method of HTTP_METHODS) {
      const pathHandlers = this.handlers[method];

      for (const handlers of pathHandlers.values()) {
        for (const handler of handlers) {
          handler.checkTimes();
        }
      }
    }
  }

  clear() {
    this.requestSavingGeneration++;

    this.workerOrThrow.clearHandlers({ interceptor: this });

    const clearPromises: Promise<AnyHttpRequestHandlerImplementation>[] = [];

    for (const method of HTTP_METHODS) {
      for (const result of this.clearMethodHandlers(method)) {
        clearPromises.push(Promise.resolve(result));
      }

      const pathHandlers = this.handlers[method];
      pathHandlers.clear();
    }

    return Promise.all(clearPromises);
  }

  private clearMethodHandlers(method: HttpMethod) {
    const pathHandlers = this.handlers[method];
    const clearResults: PossiblePromise<AnyHttpRequestHandlerImplementation>[] = [];

    for (const handlers of pathHandlers.values()) {
      for (const handler of handlers) {
        clearResults.push(handler.clear());
      }
    }

    return clearResults;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpInterceptorImplementation = HttpInterceptorImplementation<any>;

export type SharedHttpInterceptorImplementation<Schema extends HttpSchema> = HttpInterceptorImplementation<
  Schema,
  typeof LocalHttpRequestHandler
> &
  HttpInterceptorImplementation<Schema, typeof RemoteHttpRequestHandler>;

export default HttpInterceptorImplementation;
