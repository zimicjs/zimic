import { HttpRequest, HttpResponse, HttpMethod, HttpSchema, HttpHeadersInit, HttpBody } from '@zimic/http';
import { createRegexFromPath, excludeNonPathParams, validatePathParams } from '@zimic/utils/url';
import { SharedOptions as MSWWorkerSharedOptions, bypass, http, passthrough } from 'msw';

import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { removeArrayIndex } from '@/utils/arrays';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorImplementation, {
  AnyHttpInterceptorImplementation,
} from '../interceptor/HttpInterceptorImplementation';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/http';
import { MSWHttpHandler, MSWWorker } from './types/msw';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  baseURL: string;
  method: HttpMethod;
  pathRegex: RegExp;
  interceptor: AnyHttpInterceptorImplementation;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response>;
}

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
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

  private store = new LocalMSWWorkerStore();

  constructor(_options: LocalHttpInterceptorWorkerOptions) {
    super();
  }

  get class() {
    return LocalHttpInterceptorWorker;
  }

  static get isMSWWorkerRunning() {
    return new LocalMSWWorkerStore().isMSWWorkerRunning();
  }

  get type() {
    return 'local' as const;
  }

  get mswWorkerOrThrow() {
    /* istanbul ignore if -- @preserve
     * Trying to access the internal worker when it does not exist should not happen. */
    if (!this.store.mswWorker) {
      throw new NotRunningHttpInterceptorError();
    }
    return this.store.mswWorker;
  }

  async getMSWWorkerOrCreate() {
    return this.store.getMSWWorkerOrCreate({
      createUnknownPlatformError: () => new UnknownHttpInterceptorPlatformError(),
    });
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
      } else {
        this.platform = 'node';
      }

      await this.store.startMSWWorker(mswWorker, sharedOptions);
      this.isRunning = true;
    });
  }

  async stop() {
    await super.sharedStop(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      this.clearHandlers();

      const newMSWHandlers = mswWorker.listHandlers().filter((handler) => handler !== this.mswHttpHandler);
      mswWorker.resetHandlers(...newMSWHandlers);

      this.store.stopMSWWorker(mswWorker);

      this.mswHttpHandler = undefined;
      this.isRunning = false;
    });
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    return this.store.isInternalBrowserWorker(worker);
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
