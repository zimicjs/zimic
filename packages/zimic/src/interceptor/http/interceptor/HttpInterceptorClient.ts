import {
  HTTP_METHODS,
  HttpMethod,
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { joinURL, ExtendedURL } from '@/utils/urls';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import { HttpResponseFactoryResult } from '../interceptorWorker/types/requests';
import HttpRequestHandlerClient, { AnyHttpRequestHandlerClient } from '../requestHandler/HttpRequestHandlerClient';
import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import { HttpRequestHandler } from '../requestHandler/types/public';
import { HttpInterceptorRequest } from '../requestHandler/types/requests';
import NotStartedHttpInterceptorError from './errors/NotStartedHttpInterceptorError';
import HttpInterceptorStore from './HttpInterceptorStore';
import { UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestContext } from './types/requests';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['http', 'https']);

class HttpInterceptorClient<
  Schema extends HttpServiceSchema,
  HandlerConstructor extends HttpRequestHandlerConstructor = HttpRequestHandlerConstructor,
> {
  private worker: HttpInterceptorWorker;
  private store: HttpInterceptorStore;
  private _baseURL: ExtendedURL;
  private _isRunning = false;
  private onUnhandledRequest?: UnhandledRequestStrategy;

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
  }) {
    this.worker = options.worker;
    this.store = options.store;
    this._baseURL = options.baseURL;
    this.Handler = options.Handler;
    this.onUnhandledRequest = options.onUnhandledRequest;
  }

  baseURL() {
    return this._baseURL;
  }

  platform() {
    return this.worker.platform();
  }

  isRunning() {
    return this.worker.isRunning() && this._isRunning;
  }

  async start() {
    if (this.onUnhandledRequest) {
      this.worker.onUnhandledRequest(this.baseURL().toString(), this.onUnhandledRequest);
    }

    await this.worker.start();
    this.markAsRunning(true);
  }

  async stop() {
    this.markAsRunning(false);
    this.worker.offUnhandledRequest(this.baseURL().toString());

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

  get(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('GET' as HttpServiceSchemaMethod<Schema>, path);
  }

  post(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('POST' as HttpServiceSchemaMethod<Schema>, path);
  }

  patch(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('PATCH' as HttpServiceSchemaMethod<Schema>, path);
  }

  put(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('PUT' as HttpServiceSchemaMethod<Schema>, path);
  }

  delete(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('DELETE' as HttpServiceSchemaMethod<Schema>, path);
  }

  head(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('HEAD' as HttpServiceSchemaMethod<Schema>, path);
  }

  options(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestHandler('OPTIONS' as HttpServiceSchemaMethod<Schema>, path);
  }

  private createHttpRequestHandler<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(method: Method, path: Path): HttpRequestHandler<Schema, Method, Path> {
    if (!this.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const handler = new this.Handler<Schema, Method, Path>(this as SharedHttpInterceptorClient<Schema>, method, path);
    return handler;
  }

  registerRequestHandler<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
  >(
    handler:
      | LocalHttpRequestHandler<Schema, Method, Path, StatusCode>
      | RemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
  ) {
    const handlerClients = this.handlerClientsByMethod[handler.method()].get(handler.path()) ?? [];
    if (!handlerClients.includes(handler.client())) {
      handlerClients.push(handler.client());
    }

    const isFirstHandlerForMethodPath = handlerClients.length === 1;
    if (!isFirstHandlerForMethodPath) {
      return;
    }

    this.handlerClientsByMethod[handler.method()].set(handler.path(), handlerClients);
    const pathWithBaseURL = joinURL(this.baseURL(), handler.path());

    const registrationResult = this.worker.use(this, handler.method(), pathWithBaseURL, async (context) => {
      const response = await this.handleInterceptedRequest(
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
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(method: Method, path: Path, { request }: Context): Promise<HttpResponseFactoryResult> {
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<Default<Schema[Path][Method]>>(request);
    const matchedHandler = this.findMatchedHandler(method, path, parsedRequest);

    if (matchedHandler) {
      const responseDeclaration = await matchedHandler.applyResponseDeclaration(parsedRequest);
      const response = HttpInterceptorWorker.createResponseFromDeclaration(request, responseDeclaration);
      const responseToReturn = response.clone();

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(response);

      matchedHandler.registerInterceptedRequest(parsedRequest, parsedResponse);

      return { response: responseToReturn };
    } else {
      return { bypass: true };
    }
  }

  private findMatchedHandler<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(
    method: Method,
    path: Path,
    parsedRequest: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HttpRequestHandlerClient<Schema, Method, Path, any> | undefined {
    const methodPathHandlers = this.handlerClientsByMethod[method].get(path);
    const matchedHandler = methodPathHandlers?.findLast((handler) => handler.matchesRequest(parsedRequest));
    return matchedHandler;
  }

  clear(options: { onCommitSuccess?: () => void; onCommitError?: () => void } = {}) {
    if (!this.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const clearResults: PossiblePromise<AnyHttpRequestHandlerClient | void>[] = [];

    for (const method of HTTP_METHODS) {
      clearResults.push(...this.bypassMethodHandlers(method));
      this.handlerClientsByMethod[method].clear();
    }

    const clearResult = this.worker.clearInterceptorHandlers(this);
    clearResults.push(clearResult);

    if (options.onCommitSuccess) {
      void Promise.all(clearResults).then(options.onCommitSuccess, options.onCommitError);
    }
  }

  private bypassMethodHandlers(method: HttpMethod) {
    const bypassResults: PossiblePromise<AnyHttpRequestHandlerClient>[] = [];

    for (const handlers of this.handlerClientsByMethod[method].values()) {
      for (const handler of handlers) {
        bypassResults.push(handler.bypass());
      }
    }

    return bypassResults;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpInterceptorClient = HttpInterceptorClient<any>;

export type HttpRequestHandlerConstructor = typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

export type SharedHttpInterceptorClient<Schema extends HttpServiceSchema> = HttpInterceptorClient<
  Schema,
  typeof LocalHttpRequestHandler
> &
  HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>;

export default HttpInterceptorClient;
