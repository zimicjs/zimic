import {
  HTTP_METHODS,
  HttpMethod,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { joinURL, ExtendedURL, createRegexFromURL } from '@/utils/urls';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import HttpRequestHandlerClient, { AnyHttpRequestHandlerClient } from '../requestHandler/HttpRequestHandlerClient';
import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import { HttpRequestHandler, InternalHttpRequestHandler } from '../requestHandler/types/public';
import { HttpInterceptorRequest } from '../requestHandler/types/requests';
import NotStartedHttpInterceptorError from './errors/NotStartedHttpInterceptorError';
import HttpInterceptorStore from './HttpInterceptorStore';
import { UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestContext } from './types/requests';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['http', 'https']);

class HttpInterceptorClient<
  Schema extends HttpSchema,
  HandlerConstructor extends HttpRequestHandlerConstructor = HttpRequestHandlerConstructor,
> {
  private worker: HttpInterceptorWorker;
  private store: HttpInterceptorStore;
  private _baseURL: ExtendedURL;
  private _isRunning = false;
  private _onUnhandledRequest?: UnhandledRequestStrategy;
  private _shouldSaveRequests = false;

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
    worker: HttpInterceptorWorker;
    store: HttpInterceptorStore;
    baseURL: ExtendedURL;
    Handler: HandlerConstructor;
    onUnhandledRequest?: UnhandledRequestStrategy;
    saveRequests?: boolean;
  }) {
    this.worker = options.worker;
    this.store = options.store;
    this._baseURL = options.baseURL;
    this.Handler = options.Handler;
    this._onUnhandledRequest = options.onUnhandledRequest;
    this._shouldSaveRequests = options.saveRequests ?? false;
  }

  baseURL() {
    return this._baseURL;
  }

  platform() {
    return this.worker.platform();
  }

  onUnhandledRequest() {
    return this._onUnhandledRequest;
  }

  isRunning() {
    return this.worker.isRunning() && this._isRunning;
  }

  shouldSaveRequests() {
    return this._shouldSaveRequests;
  }

  async start() {
    await this.worker.start();

    this.worker.registerRunningInterceptor(this);
    this.markAsRunning(true);
  }

  async stop() {
    this.markAsRunning(false);
    this.worker.unregisterRunningInterceptor(this);

    const wasLastRunningInterceptor = this.numberOfRunningInterceptors() === 0;
    if (wasLastRunningInterceptor) {
      await this.worker.stop();
    }
  }

  private markAsRunning(isRunning: boolean) {
    if (this.worker instanceof LocalHttpInterceptorWorker) {
      this.store.markLocalInterceptorAsRunning(this, isRunning);
    } else {
      this.store.markRemoteInterceptorAsRunning(this, isRunning, this._baseURL);
    }
    this._isRunning = isRunning;
  }

  private numberOfRunningInterceptors() {
    if (this.worker instanceof LocalHttpInterceptorWorker) {
      return this.store.numberOfRunningLocalInterceptors();
    } else {
      return this.store.numberOfRunningRemoteInterceptors(this._baseURL);
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
    if (!this.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const handler = new this.Handler<Schema, Method, Path>(this as SharedHttpInterceptorClient<Schema>, method, path);
    return handler;
  }

  registerRequestHandler<
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    StatusCode extends HttpStatusCode = never,
  >(handler: InternalHttpRequestHandler<Schema, Method, Path, StatusCode>) {
    const handlerClients = this.handlerClientsByMethod[handler.method()].get(handler.path()) ?? [];
    if (!handlerClients.includes(handler.client())) {
      handlerClients.push(handler.client());
    }

    const isFirstHandlerForMethodPath = handlerClients.length === 1;
    if (!isFirstHandlerForMethodPath) {
      return;
    }

    this.handlerClientsByMethod[handler.method()].set(handler.path(), handlerClients);

    const url = joinURL(this.baseURL(), handler.path());
    const urlRegex = createRegexFromURL(url);

    const registrationResult = this.worker.use(this, handler.method(), url, async (context) => {
      const response = await this.handleInterceptedRequest(
        urlRegex,
        handler.method(),
        handler.path(),
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
  >(matchedURLRegex: RegExp, method: Method, path: Path, { request }: Context): Promise<Response | null> {
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<Path, Default<Schema[Path][Method]>>(request, {
      urlRegex: matchedURLRegex,
    });

    const matchedHandler = await this.findMatchedHandler(method, path, parsedRequest);

    if (!matchedHandler) {
      return null;
    }

    const responseDeclaration = await matchedHandler.applyResponseDeclaration(parsedRequest);
    const response = HttpInterceptorWorker.createResponseFromDeclaration(request, responseDeclaration);

    if (this.shouldSaveRequests()) {
      const responseClone = response.clone();

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(responseClone);

      matchedHandler.saveInterceptedRequest(parsedRequest, parsedResponse);
    }

    return response;
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
    const methodPathHandlers = this.handlerClientsByMethod[method].get(path) ?? [];

    for (let handlerIndex = methodPathHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = methodPathHandlers[handlerIndex];
      if (await handler.matchesRequest(parsedRequest)) {
        return handler;
      }
    }

    return undefined;
  }

  clear(options: { onCommitSuccess?: () => void; onCommitError?: () => void } = {}) {
    if (!this.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient | void>[] = [];

    for (const method of HTTP_METHODS) {
      clearResults.push(...this.clearMethodHandlers(method));
      this.handlerClientsByMethod[method].clear();
    }

    const clearResult = this.worker.clearInterceptorHandlers(this);
    clearResults.push(clearResult);

    if (options.onCommitSuccess) {
      void Promise.all(clearResults).then(options.onCommitSuccess, options.onCommitError);
    }
  }

  private clearMethodHandlers(method: HttpMethod) {
    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient>[] = [];

    for (const handlers of this.handlerClientsByMethod[method].values()) {
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
