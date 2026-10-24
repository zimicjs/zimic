import { HttpRequest, HttpResponse, HttpSchema, HttpHeadersInit, HttpBody } from '@zimic/http';
import { SharedOptions as MSWWorkerSharedOptions, HttpHandler as MSWHttpHandler, bypass, http, passthrough } from 'msw';

import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { MSWWorker } from '@/interceptor/types/msw';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorImplementation from '../interceptor/HttpInterceptorImplementation';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  private mswHttpHandler?: MSWHttpHandler;

  private store = new LocalMSWWorkerStore();

  constructor(_options: LocalHttpInterceptorWorkerOptions) {
    super();
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
      createUnknownPlatformError:
        // The unknown platform error is created here to prevent the store from relying on HTTP-specific resources.
        /* istanbul ignore next -- @preserve
         * Unknown runtime platforms are not part of the package test matrix. */
        () => new UnknownHttpInterceptorPlatformError(),
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

      try {
        await this.store.startMSWWorker(mswWorker, sharedOptions);
      } catch (error) {
        const newMSWHandlers = mswWorker.listHandlers().filter((handler) => handler !== this.mswHttpHandler);
        mswWorker.resetHandlers(...newMSWHandlers);
        this.mswHttpHandler = undefined;
        throw error;
      }

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

  async createResponseFromDeclaration(
    request: HttpRequest,
    declaration:
      { status: number; headers?: HttpHeadersInit; body?: HttpBody } | { action: UnhandledRequestStrategy.Action },
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
    const { response } = await this.createResponseWithHandlers(request);

    if (!response) {
      return this.bypassOrRejectUnhandledRequest(request);
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
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

    this.clearHttpHandlers(options.interceptor);
  }
}

export default LocalHttpInterceptorWorker;
