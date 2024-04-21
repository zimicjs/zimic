import {
  HttpHandler as MSWHttpHandler,
  SharedOptions as MSWWorkerSharedOptions,
  StrictRequest as MSWStrictRequest,
  http,
  passthrough,
} from 'msw';

import { HttpBody } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from './errors/OtherHttpInterceptorWorkerRunningError';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { PublicLocalHttpInterceptorWorker } from './types/public';
import { BrowserHttpWorker, HttpRequestHandler, HttpWorker, NodeHttpWorker } from './types/requests';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker implements PublicLocalHttpInterceptorWorker {
  readonly type = 'local';

  private static runningInstance?: LocalHttpInterceptorWorker;
  private _internalWorker?: HttpWorker;

  private httpHandlerGroups: {
    interceptor: HttpInterceptorClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    httpHandler: MSWHttpHandler;
  }[] = [];

  internalWorkerOrThrow() {
    if (!this._internalWorker) {
      throw new NotStartedHttpInterceptorWorkerError();
    }
    return this._internalWorker;
  }

  async internalWorkerOrLoad() {
    if (!this._internalWorker) {
      this._internalWorker = await this.createInternalWorker();
    }
    return this._internalWorker;
  }

  private async createInternalWorker() {
    const { setupServer } = await import('msw/node');
    if (typeof setupServer !== 'undefined') {
      return setupServer();
    }

    const { setupWorker } = await import('msw/browser');
    if (typeof setupWorker !== 'undefined') {
      return setupWorker();
    }

    throw new UnknownHttpInterceptorWorkerPlatform();
  }

  async start() {
    if (LocalHttpInterceptorWorker.runningInstance && LocalHttpInterceptorWorker.runningInstance !== this) {
      throw new OtherHttpInterceptorWorkerRunningError();
    }

    if (this.isRunning()) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();
    const sharedOptions: MSWWorkerSharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isInternalBrowserWorker(internalWorker)) {
      this.setPlatform('browser');
      await this.startInBrowser(internalWorker, sharedOptions);
    } else {
      this.setPlatform('node');
      this.startInNode(internalWorker, sharedOptions);
    }

    this.setIsRunning(true);
    LocalHttpInterceptorWorker.runningInstance = this;
  }

  private async startInBrowser(internalWorker: BrowserHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
    try {
      await internalWorker.start({ ...sharedOptions, quiet: true });
    } catch (error) {
      this.handleBrowserWorkerStartError(error);
    }
  }

  private handleBrowserWorkerStartError(error: unknown) {
    if (UnregisteredServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredServiceWorkerError();
    }
    throw error;
  }

  private startInNode(internalWorker: NodeHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
    internalWorker.listen(sharedOptions);
  }

  async stop() {
    if (!this.isRunning()) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();

    if (this.isInternalBrowserWorker(internalWorker)) {
      this.stopInBrowser(internalWorker);
    } else {
      this.stopInNode(internalWorker);
    }

    this.clearHandlers();

    this.setIsRunning(false);
    LocalHttpInterceptorWorker.runningInstance = undefined;
  }

  private stopInBrowser(internalWorker: BrowserHttpWorker) {
    internalWorker.stop();
  }

  private stopInNode(internalWorker: NodeHttpWorker) {
    internalWorker.close();
  }

  private isInternalBrowserWorker(worker: HttpWorker): worker is BrowserHttpWorker {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.internalWorkerOrThrow());
  }

  hasInternalNodeWorker() {
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    handler: HttpRequestHandler,
  ) {
    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const normalizedURL = super.normalizeUseURL(url);

    const httpHandler = http[lowercaseMethod](normalizedURL, async (context) => {
      const result = await handler({
        ...context,
        request: context.request as MSWStrictRequest<HttpBody>,
      });
      return result.bypass ? passthrough() : result.response;
    });

    internalWorker.use(httpHandler);

    this.httpHandlerGroups.push({ interceptor, httpHandler });
  }

  clearHandlers() {
    this._internalWorker?.resetHandlers();
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    const httpHandlerGroupsToKeep = this.httpHandlerGroups.filter((group) => group.interceptor !== interceptor);

    const httpHandlersToKeep = httpHandlerGroupsToKeep.map((group) => group.httpHandler);

    this._internalWorker?.resetHandlers();
    for (const handler of httpHandlersToKeep) {
      this._internalWorker?.use(handler);
    }

    this.httpHandlerGroups = httpHandlerGroupsToKeep;
  }

  interceptorsWithHandlers() {
    return this.httpHandlerGroups.map((group) => group.interceptor);
  }
}

export default LocalHttpInterceptorWorker;