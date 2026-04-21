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
import { BrowserMSWWorker, MSWHttpHandler, MSWWorker, NodeMSWWorker } from './types/msw';
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
  // workers are stopped. See https://github.com/mswjs/msw/issues/2597.
  private static mswWorker?: MSWWorker;
  static isMSWWorkerRunning = false;

  private mswHttpHandler?: MSWHttpHandler;

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

  get mswWorkerOrThrow() {
    /* istanbul ignore if -- @preserve
     * Trying to access the internal worker when it does not exist should not happen. */
    if (!this.class.mswWorker) {
      throw new NotRunningHttpInterceptorError();
    }
    return this.class.mswWorker;
  }

  async getMSWWorkerOrCreate() {
    this.class.mswWorker ??= await this.createMSWWorker();
    return this.class.mswWorker;
  }

  private async createMSWWorker() {
    if (isServerSide()) {
      const mswNode = await importMSWNode();

      /* istanbul ignore else -- @preserve
       * We still check if we actually imported the server module in case our `isServerSide()` check returns true, but
       * the environment actually resolves the browser module. */
      if ('setupServer' in mswNode) {
        return mswNode.setupServer();
      }
    }

    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      const mswBrowser = await importMSWBrowser();

      /* istanbul ignore else -- @preserve
       * We still check if we actually imported the browser module in case our `isClientSide()` check returns true, but
       * the environment actually resolves the server module. */
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
      const mswWorker = await this.getMSWWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      this.mswHttpHandler = http.all('*', async (context) => {
        const request = context.request satisfies Request as HttpRequest;
        const response = await this.createResponseForRequest(request);
        return response;
      });

      mswWorker.use(this.mswHttpHandler);

      if (this.isInternalBrowserWorker(mswWorker)) {
        this.platform = 'browser';

        // Even after https://github.com/mswjs/msw/issues/2714 was fixed, there are collateral effects preventing us
        // from restarting the global browser worker even if unused. Restarting it causes interception issues in MSW.
        if (!this.class.isMSWWorkerRunning) {
          await this.startInBrowser(mswWorker, sharedOptions);
          this.class.isMSWWorkerRunning = true;
        }
      } else {
        this.platform = 'node';
        this.startInNode(mswWorker, sharedOptions);
        this.class.isMSWWorkerRunning = true;
      }

      this.isRunning = true;
    });
  }

  private async startInBrowser(mswWorker: BrowserMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    try {
      await mswWorker.start({ ...sharedOptions, quiet: true });
    } catch (error) {
      this.handleBrowserWorkerStartError(error);
    }
  }

  private handleBrowserWorkerStartError(error: unknown) {
    /* istanbul ignore else -- @preserve
     * Since we start the internal worker once and do not stop it, tests may not be able exercise this branch. */
    if (UnregisteredBrowserServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredBrowserServiceWorkerError();
    } else {
      throw error;
    }
  }

  private startInNode(mswWorker: NodeMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    mswWorker.listen(sharedOptions);
  }

  async stop() {
    await super.sharedStop(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      this.clearHandlers();

      const newMSWHandlers = mswWorker.listHandlers().filter((handler) => handler !== this.mswHttpHandler);
      mswWorker.resetHandlers(...newMSWHandlers);

      if (this.isInternalBrowserWorker(mswWorker)) {
        // Even after https://github.com/mswjs/msw/issues/2714 was fixed, restarting browser workers causes interception
        // issues, so we keep it running and just remove our handlers.
      } else {
        this.stopInNode(mswWorker);
        this.class.isMSWWorkerRunning = false;
      }

      this.mswHttpHandler = undefined;
      this.isRunning = false;
    });
  }

  private stopInNode(mswWorker: NodeMSWWorker) {
    mswWorker.close();
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.mswWorkerOrThrow);
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
