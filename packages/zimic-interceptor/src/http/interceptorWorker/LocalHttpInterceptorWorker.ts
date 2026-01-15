import { HttpRequest, HttpResponse, HttpMethod, HttpSchema, HttpHeadersInit, HttpBody } from '@zimic/http';
import { createRegexFromPath, excludeNonPathParams, validatePathParams } from '@zimic/utils/url';
import { SharedOptions as MSWWorkerSharedOptions, bypass, http, passthrough } from 'msw';
import * as mswBrowser from 'msw/browser';
import * as mswNode from 'msw/node';

import { removeArrayIndex } from '@/utils/arrays';
import { isClientSide, isServerSide } from '@/utils/environment';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/http';
import { BrowserMSWWorker, MSWWorker, NodeMSWWorker } from './types/msw';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  baseURL: string;
  method: HttpMethod;
  pathRegex: RegExp;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response>;
}

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  // Re-creating MSW workers may cause issues, so we should keep a single worker instance, even if all interceptor
  // workers are stopped. See https://github.com/mswjs/msw/issues/2585.
  private static globalInternalWorker?: MSWWorker;
  private internalWorker?: MSWWorker;

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
  }

  get class() {
    return LocalHttpInterceptorWorker;
  }

  get type() {
    return 'local' as const;
  }

  get internalWorkerOrThrow() {
    /* istanbul ignore if -- @preserve
     * Trying to access the internal worker when it does not exist should not happen. */
    if (!this.internalWorker) {
      throw new NotRunningHttpInterceptorError();
    }
    return this.internalWorker;
  }

  get internalWorkerOrCreate() {
    this.class.globalInternalWorker ??= this.createInternalWorker();
    this.internalWorker ??= this.class.globalInternalWorker;
    return this.internalWorker;
  }

  private createInternalWorker() {
    const mswHttpHandler = http.all('*', async (context) => {
      const request = context.request satisfies Request as HttpRequest;
      const response = await this.createResponseForRequest(request);
      return response;
    });

    if (isServerSide() && 'setupServer' in mswNode) {
      return mswNode.setupServer(mswHttpHandler);
    }

    /* istanbul ignore else -- @preserve */
    if (isClientSide() && 'setupWorker' in mswBrowser) {
      return mswBrowser.setupWorker(mswHttpHandler);
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

      this.clearHandlers();

      if (this.isInternalBrowserWorker(internalWorker)) {
        this.stopInBrowser(internalWorker);
      } else {
        this.stopInNode(internalWorker);
      }

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
    createResponse: HttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validatePathParams(path);

    const methodHandlers = this.httpHandlersByMethod[method];

    const handler: HttpHandler = {
      baseURL: interceptor.baseURLAsString,
      method,
      pathRegex: createRegexFromPath(path),
      interceptor,
      createResponse: async (context) => {
        const request = context.request as HttpRequest;
        const requestClone = request.clone();

        let response: HttpResponse | null = null;

        try {
          response = await createResponse({ request });
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

  async createResponseFromDeclaration(
    request: HttpRequest,
    declaration:
      | { status: number; headers?: HttpHeadersInit; body?: HttpBody }
      | { action: UnhandledRequestStrategy.Action },
  ) {
    const requestClone = request.clone();
    const response = await super.createResponseFromDeclaration(request, declaration);

    if (response && HttpInterceptorWorker.isBypassedResponse(response)) {
      try {
        const response = (await fetch(bypass(requestClone))) as HttpResponse;
        return response;
      } catch (error) {
        console.error(error);
        return null;
      }
    }

    if (response && HttpInterceptorWorker.isRejectedResponse(response)) {
      return response;
    }

    return response;
  }

  private async createResponseForRequest(request: HttpRequest) {
    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];

    const requestURL = excludeNonPathParams(new URL(request.url));
    const requestURLAsString = requestURL.href === `${requestURL.origin}/` ? requestURL.origin : requestURL.href;

    for (let handlerIndex = methodHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = methodHandlers[handlerIndex];
      const matchesBaseURL = requestURLAsString.startsWith(handler.baseURL);

      if (!matchesBaseURL) {
        continue;
      }

      const requestPath = requestURLAsString.replace(handler.baseURL, '');
      const matchesPath = handler.pathRegex.test(requestPath);

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
      return Response.error() as HttpResponse;
    } else {
      return passthrough() as HttpResponse;
    }
  }

  clearHandlers<Schema extends HttpSchema>(
    options: {
      interceptor?: HttpInterceptorClient<Schema>;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    if (options.interceptor === undefined) {
      for (const handlers of Object.values(this.httpHandlersByMethod)) {
        handlers.length = 0;
      }
    } else {
      for (const methodHandlers of Object.values(this.httpHandlersByMethod)) {
        const groupToRemoveIndex = methodHandlers.findIndex((group) => group.interceptor === options.interceptor);
        removeArrayIndex(methodHandlers, groupToRemoveIndex);
      }
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
