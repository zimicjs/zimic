import { HttpRequest, HttpResponse, HttpMethod, HttpSchema } from '@zimic/http';
import createPathRegExp from '@zimic/utils/url/createPathRegExp';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import validateURLPathParams from '@zimic/utils/url/validateURLPathParams';
import { SharedOptions as MSWWorkerSharedOptions, http, passthrough } from 'msw';
import * as mswBrowser from 'msw/browser';
import * as mswNode from 'msw/node';

import { removeArrayIndex } from '@/utils/arrays';
import { isClientSide, isServerSide } from '@/utils/environment';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactoryContext } from './types/http';
import { BrowserMSWWorker, MSWHandler, MSWHttpResponseFactory, MSWWorker, NodeMSWWorker } from './types/msw';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  baseURL: string;
  pathPattern: RegExp;
  method: HttpMethod;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response>;
}

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  private internalWorker?: MSWWorker;

  private defaultMSWHttpHandler: MSWHandler;

  private httpHandlersByMethod: {
    [Method in HttpMethod]: HttpHandler[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  constructor(_options: LocalHttpInterceptorWorkerOptions) {
    super();

    this.defaultMSWHttpHandler = http.all('*', async (context) => {
      const response = await this.createResponseForRequest(context.request satisfies Request as HttpRequest);
      return response;
    });
  }

  get type() {
    return 'local' as const;
  }

  get internalWorkerOrThrow() {
    if (!this.internalWorker) {
      throw new NotRunningHttpInterceptorError();
    }
    return this.internalWorker;
  }

  get internalWorkerOrCreate() {
    this.internalWorker ??= this.createInternalWorker();
    return this.internalWorker;
  }

  private createInternalWorker() {
    if (isServerSide() && 'setupServer' in mswNode) {
      return mswNode.setupServer(this.defaultMSWHttpHandler);
    }
    /* istanbul ignore else -- @preserve */
    if (isClientSide() && 'setupWorker' in mswBrowser) {
      return mswBrowser.setupWorker(this.defaultMSWHttpHandler);
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async start() {
    await super.sharedStart(async () => {
      const internalWorker = this.internalWorkerOrCreate;

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      if (this.isInternalBrowserWorker(internalWorker)) {
        this.platform = 'browser';
        await this.startInBrowser(internalWorker, sharedOptions);
      } else {
        this.platform = 'node';
        this.startInNode(internalWorker, sharedOptions);
      }

      this.isRunning = true;
    });
  }

  private async startInBrowser(internalWorker: BrowserMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    try {
      await internalWorker.start({ ...sharedOptions, quiet: true });
    } catch (error) {
      this.handleBrowserWorkerStartError(error);
    }
  }

  private handleBrowserWorkerStartError(error: unknown) {
    if (UnregisteredBrowserServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredBrowserServiceWorkerError();
    }
    throw error;
  }

  private startInNode(internalWorker: NodeMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    internalWorker.listen(sharedOptions);
  }

  async stop() {
    await super.sharedStop(() => {
      const internalWorker = this.internalWorkerOrCreate;

      if (this.isInternalBrowserWorker(internalWorker)) {
        this.stopInBrowser(internalWorker);
      } else {
        this.stopInNode(internalWorker);
      }
      this.clearHandlers();

      this.internalWorker = undefined;
      this.isRunning = false;
    });
  }

  private stopInBrowser(internalWorker: BrowserMSWWorker) {
    internalWorker.stop();
  }

  private stopInNode(internalWorker: NodeMSWWorker) {
    internalWorker.close();
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.internalWorkerOrThrow);
  }

  hasInternalNodeWorker() {
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    path: string,
    createResponse: MSWHttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validateURLPathParams(path);

    const methodHandlers = this.httpHandlersByMethod[method];

    const handler: HttpHandler = {
      baseURL: interceptor.baseURLAsString,
      pathPattern: createPathRegExp(path),
      method,
      interceptor,
      createResponse: async (context) => {
        const request = context.request as HttpRequest;
        const requestClone = request.clone();

        let response: HttpResponse | null = null;

        try {
          response = await createResponse({ ...context, request });
        } catch (error) {
          console.error(error);
        }

        if (!response) {
          return this.bypassOrRejectUnhandledRequest(requestClone);
        }

        if (context.request.method === 'HEAD') {
          return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }

        return response;
      },
    };

    methodHandlers.push(handler);
  }

  private async createResponseForRequest(request: HttpRequest) {
    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];

    const requestURL = excludeURLParams(new URL(request.url));
    const requestURLAsString = requestURL.href === `${requestURL.origin}/` ? requestURL.origin : requestURL.href;

    for (let handlerIndex = methodHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = methodHandlers[handlerIndex];

      const matchesBaseURL = requestURLAsString.startsWith(handler.baseURL);

      if (!matchesBaseURL) {
        continue;
      }

      const requestPath = requestURLAsString.replace(handler.baseURL, '');
      const matchesPath = handler.pathPattern.test(requestPath);

      if (!matchesPath) {
        continue;
      }

      const response = await handler.createResponse({ request });
      return response;
    }

    return this.bypassOrRejectUnhandledRequest(request);
  }

  private async bypassOrRejectUnhandledRequest(request: HttpRequest) {
    const requestClone = request.clone();

    const strategy = await super.getUnhandledRequestStrategy(request, 'local');
    await super.logUnhandledRequestIfNecessary(requestClone, strategy);

    if (strategy?.action === 'reject') {
      return Response.error();
    } else {
      return passthrough();
    }
  }

  clearHandlers() {
    this.internalWorkerOrThrow.resetHandlers();

    for (const handlers of Object.values(this.httpHandlersByMethod)) {
      handlers.length = 0;
    }
  }

  clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    for (const handlers of Object.values(this.httpHandlersByMethod)) {
      const groupToRemoveIndex = handlers.findIndex((group) => group.interceptor === interceptor);
      removeArrayIndex(handlers, groupToRemoveIndex);
    }
  }

  get interceptorsWithHandlers() {
    const interceptors = new Set<AnyHttpInterceptorClient>();

    for (const handlers of Object.values(this.httpHandlersByMethod)) {
      for (const handler of handlers) {
        interceptors.add(handler.interceptor);
      }
    }

    return Array.from(interceptors);
  }
}

export default LocalHttpInterceptorWorker;
