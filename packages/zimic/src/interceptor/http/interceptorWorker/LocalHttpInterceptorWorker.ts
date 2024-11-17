import { HttpHandler as MSWHttpHandler, SharedOptions as MSWWorkerSharedOptions, http, passthrough } from 'msw';
import * as mswBrowser from 'msw/browser';
import * as mswNode from 'msw/node';

import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpSchema } from '@/http/types/schema';
import { createURL, ensureUniquePathParams, excludeNonPathParams } from '@/utils/urls';

import NotStartedHttpInterceptorError from '../interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions } from './types/options';
import {
  BrowserHttpWorker,
  HttpResponseFactory,
  HttpResponseFactoryResult,
  HttpWorker,
  NodeHttpWorker,
} from './types/requests';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  readonly type: 'local';

  private _internalWorker?: HttpWorker;

  private defaultHttpHandler: MSWHttpHandler;

  private httpHandlerGroups: {
    interceptor: HttpInterceptorClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    httpHandler: MSWHttpHandler;
  }[] = [];

  constructor(options: LocalHttpInterceptorWorkerOptions) {
    super();
    this.type = options.type;

    this.defaultHttpHandler = http.all('*', async (context) => {
      const request = context.request satisfies Request as HttpRequest;
      return this.bypassOrRejectUnhandledRequest(request);
    });
  }

  internalWorkerOrThrow() {
    if (!this._internalWorker) {
      throw new NotStartedHttpInterceptorError();
    }
    return this._internalWorker;
  }

  internalWorkerOrCreate() {
    if (!this._internalWorker) {
      this._internalWorker = this.createInternalWorker();
    }
    return this._internalWorker;
  }

  private createInternalWorker() {
    if (typeof mswNode.setupServer !== 'undefined') {
      return mswNode.setupServer(this.defaultHttpHandler);
    }

    /* istanbul ignore else -- @preserve */
    if (typeof mswBrowser.setupWorker !== 'undefined') {
      return mswBrowser.setupWorker(this.defaultHttpHandler);
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async start() {
    await super.sharedStart(async () => {
      const internalWorker = this.internalWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      if (this.isInternalBrowserWorker(internalWorker)) {
        super.setPlatform('browser');
        await this.startInBrowser(internalWorker, sharedOptions);
      } else {
        super.setPlatform('node');
        this.startInNode(internalWorker, sharedOptions);
      }

      super.setIsRunning(true);
    });
  }

  private async startInBrowser(internalWorker: BrowserHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
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

  private startInNode(internalWorker: NodeHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
    internalWorker.listen(sharedOptions);
  }

  async stop() {
    await super.sharedStop(() => {
      const internalWorker = this.internalWorkerOrCreate();

      if (this.isInternalBrowserWorker(internalWorker)) {
        this.stopInBrowser(internalWorker);
      } else {
        this.stopInNode(internalWorker);
      }
      this.clearHandlers();

      this._internalWorker = undefined;
      super.setIsRunning(false);
    });
  }

  private stopInBrowser(internalWorker: BrowserHttpWorker) {
    internalWorker.stop();
  }

  private stopInNode(internalWorker: NodeHttpWorker) {
    internalWorker.close();
  }

  private isInternalBrowserWorker(worker: HttpWorker) {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.internalWorkerOrThrow());
  }

  hasInternalNodeWorker() {
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    rawURL: string | URL,
    createResponse: HttpResponseFactory,
  ) {
    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const url = excludeNonPathParams(createURL(rawURL)).toString();
    ensureUniquePathParams(url);

    const httpHandler = http[lowercaseMethod](url, async (context): Promise<HttpResponse> => {
      const request = context.request satisfies Request as HttpRequest;
      const requestClone = request.clone();

      let result: HttpResponseFactoryResult | null = null;

      try {
        result = await createResponse({ ...context, request });
      } catch (error) {
        console.error(error);
      }

      if (!result?.response) {
        return this.bypassOrRejectUnhandledRequest(requestClone);
      }

      if (context.request.method === 'HEAD') {
        return new Response(null, {
          status: result.response.status,
          statusText: result.response.statusText,
          headers: result.response.headers,
        });
      }

      return result.response;
    });

    internalWorker.use(httpHandler);

    this.httpHandlerGroups.push({ interceptor, httpHandler });
  }

  private async bypassOrRejectUnhandledRequest(request: HttpRequest) {
    const requestClone = request.clone();

    const strategy = super.getUnhandledRequestStrategy(request, 'local');
    await super.handleUnhandledRequest(requestClone, strategy);

    if (strategy.action === 'reject') {
      return Response.error();
    } else {
      return passthrough();
    }
  }

  clearHandlers() {
    const internalWorker = this.internalWorkerOrThrow();
    internalWorker.resetHandlers();
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    const internalWorker = this.internalWorkerOrThrow();

    const httpHandlerGroupsToKeep = this.httpHandlerGroups.filter((group) => group.interceptor !== interceptor);
    const httpHandlersToKeep = httpHandlerGroupsToKeep.map((group) => group.httpHandler);

    internalWorker.resetHandlers();

    for (const handler of httpHandlersToKeep) {
      internalWorker.use(handler);
    }

    this.httpHandlerGroups = httpHandlerGroupsToKeep;
  }

  interceptorsWithHandlers() {
    return this.httpHandlerGroups.map((group) => group.interceptor);
  }
}

export default LocalHttpInterceptorWorker;
