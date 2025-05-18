import { HttpRequest, HttpResponse, HttpMethod, HttpSchema } from '@zimic/http';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import validateURLPathParams from '@zimic/utils/url/validateURLPathParams';
import { SharedOptions as MSWWorkerSharedOptions, http, passthrough } from 'msw';
import * as mswBrowser from 'msw/browser';
import * as mswNode from 'msw/node';

import { removeArrayIndex } from '@/utils/arrays';
import { isClientSide, isServerSide } from '@/utils/environment';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnregisteredBrowserServiceWorkerError from './errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { BrowserMSWWorker, MSWHandler, MSWHttpResponseFactory, MSWWorker, NodeMSWWorker } from './types/msw';
import { LocalHttpInterceptorWorkerOptions } from './types/options';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  private internalWorker?: MSWWorker;

  private defaultHttpHandler: MSWHandler;

  private httpHandlerGroups: {
    interceptor: HttpInterceptorClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    httpHandler: MSWHandler;
  }[] = [];

  constructor(_options: LocalHttpInterceptorWorkerOptions) {
    super();

    this.defaultHttpHandler = http.all('*', async (context) => {
      const request = context.request satisfies Request as HttpRequest;
      return this.bypassOrRejectUnhandledRequest(request);
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
      return mswNode.setupServer(this.defaultHttpHandler);
    }
    /* istanbul ignore else -- @preserve */
    if (isClientSide() && 'setupWorker' in mswBrowser) {
      return mswBrowser.setupWorker(this.defaultHttpHandler);
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
    rawURL: string | URL,
    createResponse: MSWHttpResponseFactory,
  ) {
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const url = new URL(rawURL);
    excludeURLParams(url);
    validateURLPathParams(url);

    const httpHandler = http[lowercaseMethod](url.toString(), async (context) => {
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
    });

    this.internalWorkerOrThrow.use(httpHandler);

    this.httpHandlerGroups.push({ interceptor, httpHandler });
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
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    const groupToRemoveIndex = this.httpHandlerGroups.findIndex((group) => group.interceptor === interceptor);
    removeArrayIndex(this.httpHandlerGroups, groupToRemoveIndex);

    this.internalWorkerOrThrow.resetHandlers();

    for (const { httpHandler } of this.httpHandlerGroups) {
      this.internalWorkerOrThrow.use(httpHandler);
    }
  }

  get interceptorsWithHandlers() {
    return this.httpHandlerGroups.map((group) => group.interceptor);
  }
}

export default LocalHttpInterceptorWorker;
