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
import createRegexFromPath from '@zimic/utils/url/createRegexFromPath';
import excludeNonPathParams from '@zimic/utils/url/excludeNonPathParams';
import validateURLProtocol from '@zimic/utils/url/validateURLProtocol';

import { isServerSide } from '@/utils/environment';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import HttpRequestHandlerClient, {
  AnyHttpRequestHandlerClient,
  HttpRequestHandlerRequestMatch,
} from '../requestHandler/HttpRequestHandlerClient';
import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import { HttpRequestHandler, InternalHttpRequestHandler } from '../requestHandler/types/public';
import { HttpInterceptorRequest, HttpRequestHandlerResponseDeclaration } from '../requestHandler/types/requests';
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

  private createWorker: () => HttpInterceptorWorker;
  private deleteWorker: () => void;
  private worker?: HttpInterceptorWorker;

  requestSaving: HttpInterceptorRequestSaving;
  private numberOfSavedRequests = 0;

  onUnhandledRequest?: HandlerConstructor extends typeof LocalHttpRequestHandler
    ? UnhandledRequestStrategy.Local
    : UnhandledRequestStrategy.Remote;

  isRunning = false;

  private Handler: HandlerConstructor;

  private handlers: {
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
    excludeNonPathParams(newBaseURL);

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
      this.worker = this.createWorker();

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
      this.deleteWorker();
    }

    this.markAsRunning(false);
    this.worker = undefined;
  }

  private markAsRunning(isRunning: boolean) {
    if (this.workerOrThrow.type === 'local') {
      this.store.markLocalInterceptorAsRunning(this, isRunning);
    } else {
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
    const pathHandlers = this.handlers[handler.method].get(handler.path) ?? [];

    const isAlreadyRegistered = pathHandlers.includes(handler.client);

    if (isAlreadyRegistered) {
      return;
    }

    pathHandlers.push(handler.client);

    const isFirstHandlerForMethodPath = pathHandlers.length === 1;

    if (!isFirstHandlerForMethodPath) {
      return;
    }

    this.handlers[handler.method].set(handler.path, pathHandlers);

    const pathRegex = createRegexFromPath(handler.path);

    const registrationResult = this.workerOrThrow.use(this, handler.method, handler.path, async (context) => {
      const response = await this.handleInterceptedRequest(
        handler.method,
        handler.path,
        pathRegex,
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
  >(
    method: Method,
    path: Path,
    pathRegex: RegExp,
    { request }: Context,
  ): Promise<HttpResponse | { action: 'bypass' | 'reject' } | null> {
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<Path, Default<Schema[Path][Method]>>(request, {
      baseURL: this.baseURLAsString,
      pathRegex,
    });

    const matchedHandler = await this.findMatchedHandler(method, path, parsedRequest);

    if (!matchedHandler) {
      return null;
    }

    const responseDeclaration = await matchedHandler.applyResponseDeclaration(parsedRequest);

    if (!responseDeclaration) {
      return null;
    }

    const response = HttpInterceptorWorker.createResponseFromDeclaration(request, responseDeclaration);

    if (this.requestSaving.enabled && typeof responseDeclaration === 'object' && 'status' in responseDeclaration) {
      const responseClone = response.clone();

      const _status = (responseDeclaration as HttpRequestHandlerResponseDeclaration).status;

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof _status
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
    request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<HttpRequestHandlerClient<Schema, Method, Path, any> | undefined> {
    /* istanbul ignore next -- @preserve
     * Ignoring because there will always be a handler for the given method and path at this point. */
    const pathHandlers = this.handlers[method].get(path) ?? [];

    const failedRequestMatches = new Map<
      AnyHttpRequestHandlerClient,
      Extract<HttpRequestHandlerRequestMatch, { success: false }>
    >();

    // If we find a matching handler that can accept more requests, we return it immediately.
    for (let handlerIndex = pathHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = pathHandlers[handlerIndex];
      const requestMatch = await handler.matchesRequest(request);

      if (requestMatch.success) {
        handler.markRequestAsMatched(request);
        return handler;
      }

      failedRequestMatches.set(handler, requestMatch);
    }

    // If no handler matched or could accept more requests, we iterate again over the handlers to check which ones
    // could have matched considering only restrictions.
    for (let handlerIndex = pathHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = pathHandlers[handlerIndex];
      const requestMatch = failedRequestMatches.get(handler);

      // Handlers that did not match due to anything other than restrictions are still marked as matched to trigger a
      // times check error.
      if (requestMatch?.cause === 'unmatchedRestrictions') {
        handler.markRequestAsUnmatched(request, { diff: requestMatch.diff });
      } else {
        handler.markRequestAsMatched(request);
        break;
      }
    }

    return undefined;
  }

  checkTimes() {
    for (const method of HTTP_METHODS) {
      const pathHandlers = this.handlers[method];

      for (const handlers of pathHandlers.values()) {
        for (let handlerIndex = handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
          const handler = handlers[handlerIndex];
          handler.checkTimes();
        }
      }
    }
  }

  clear() {
    const clearPromises: Promise<AnyHttpRequestHandlerClient | void>[] = [
      Promise.resolve(this.workerOrThrow.clearHandlers({ interceptor: this })),
    ];

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
    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient>[] = [];

    for (const handlers of pathHandlers.values()) {
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
