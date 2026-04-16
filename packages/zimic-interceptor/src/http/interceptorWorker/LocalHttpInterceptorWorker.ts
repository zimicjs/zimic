import { HttpRequest, HttpResponse, HttpMethod, HttpSchema, HttpHeadersInit, HttpBody } from '@zimic/http';
import { createCachedDynamicImport } from '@zimic/utils/import';
import { createRegexFromPath, excludeNonPathParams, validatePathParams } from '@zimic/utils/url';
import { SharedOptions as MSWWorkerSharedOptions, bypass, http, passthrough } from 'msw';

import { removeArrayIndex } from '@/utils/arrays';
import { isClientSide, isServerSide } from '@/utils/environment';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorImplementation, {
  AnyHttpInterceptorImplementation,
} from '../interceptor/HttpInterceptorImplementation';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/http';
import { BrowserMSWWorker, MSWWorker, NodeMSWWorker } from './types/msw';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

const importMSWNode = createCachedDynamicImport(() => import('msw/node'));
const importMSWBrowser = createCachedDynamicImport(() => import('msw/browser'));

interface HttpHandler {
  baseURL: string;
  method: HttpMethod;
  pathRegex: RegExp;
  interceptor: AnyHttpInterceptorImplementation;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response>;
}

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  // Re-creating MSW workers may cause issues, so we should keep a single worker instance, even if all interceptor
  // workers are stopped. See https://github.com/mswjs/msw/issues/2585.
  private static globalInternalWorker?: MSWWorker;
  static isGlobalInternalWorkerRunning = false;

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

  async getInternalWorkerOrCreate() {
    if (this.internalWorker) {
      return this.internalWorker;
    }

    this.class.globalInternalWorker ??= await this.createInternalWorker();

    this.class.globalInternalWorker.resetHandlers(
      http.all('*', async (context) => {
        const request = context.request satisfies Request as HttpRequest;
        const response = await this.createResponseForRequest(request);
        return response;
      }),
    );

    this.internalWorker = this.class.globalInternalWorker;

    return this.internalWorker;
  }

  private async createInternalWorker() {
    if (isServerSide()) {
      const mswNode = await importMSWNode();

      if ('setupServer' in mswNode) {
        return mswNode.setupServer();
      }
    }

    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      const mswBrowser = await importMSWBrowser();

      if ('setupWorker' in mswBrowser) {
        return mswBrowser.setupWorker();
      }
    }

    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async start() {
    await super.sharedStart(async () => {
      const internalWorker = await this.getInternalWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      if (this.isInternalBrowserWorker(internalWorker)) {
        this.platform = 'browser';

        // Due to collateral effects from https://github.com/mswjs/msw/issues/2714, we can only start the global browser
        // worker once and keep it running, even if all interceptor workers are stopped. Restarting the browser worker
        // causes interception issues.
        if (!this.class.isGlobalInternalWorkerRunning) {
          await this.startInBrowser(internalWorker, sharedOptions);
          this.class.isGlobalInternalWorkerRunning = true;
        }
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
    await super.sharedStop(async () => {
      const internalWorker = await this.getInternalWorkerOrCreate();

      this.clearHandlers();

      if (this.isInternalBrowserWorker(internalWorker)) {
        // Due to collateral effects from https://github.com/mswjs/msw/issues/2714, we cannot stop the browser worker
        // because restarting it causes interception issues. Instead, we just reset its handlers and keep it running.
        if (this.platform !== 'browser') {
          this.stopInBrowser(internalWorker);
        }
      } else {
        this.stopInNode(internalWorker);
      }

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
    interceptor: HttpInterceptorImplementation<Schema>,
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
    // Due to https://github.com/mswjs/msw/issues/2597, we cannot trust that MSW won't try to handle requests even if
    // the internal worker is stopped. Because of that, we need to check if the worker is running ourselves and consider
    // the request as unhandled.
    if (!this.isRunning) {
      return this.bypassOrRejectUnhandledRequest(request);
    }

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
      interceptor?: HttpInterceptorImplementation<Schema>;
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
    const interceptors = new Set<AnyHttpInterceptorImplementation>();

    for (const handlers of Object.values(this.httpHandlersByMethod)) {
      for (const handler of handlers) {
        interceptors.add(handler.interceptor);
      }
    }

    return Array.from(interceptors);
  }
}

export default LocalHttpInterceptorWorker;
