import {
  HttpHandler as MSWHttpHandler,
  SharedOptions as MSWWorkerSharedOptions,
  StrictRequest as MSWStrictRequest,
  http,
  passthrough,
} from 'msw';

import { HttpBody } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { createURLIgnoringNonPathComponents } from '@/utils/fetch';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { PublicLocalHttpInterceptorWorker } from './types/public';
import { BrowserHttpWorker, HttpRequestHandler, HttpWorker, NodeHttpWorker } from './types/requests';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker implements PublicLocalHttpInterceptorWorker {
  readonly type = 'local';

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
    if (super.isRunning()) {
      return;
    }

    super.ensureEmptyRunningInstance();

    const internalWorker = await this.internalWorkerOrLoad();
    const sharedOptions: MSWWorkerSharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isInternalBrowserWorker(internalWorker)) {
      super.setPlatform('browser');
      await this.startInBrowser(internalWorker, sharedOptions);
    } else {
      super.setPlatform('node');
      this.startInNode(internalWorker, sharedOptions);
    }

    super.markAsRunningInstance();
    super.setIsRunning(true);
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
    if (!super.isRunning()) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();

    if (this.isInternalBrowserWorker(internalWorker)) {
      this.stopInBrowser(internalWorker);
    } else {
      this.stopInNode(internalWorker);
    }

    this.clearHandlers();

    super.setIsRunning(false);
    super.clearRunningInstance();
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
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const normalizedURL = createURLIgnoringNonPathComponents(url);

    const httpHandler = http[lowercaseMethod](normalizedURL.toString(), async (context) => {
      const result = await handler({
        ...context,
        request: context.request as MSWStrictRequest<HttpBody>,
      });

      if (result.bypass) {
        return passthrough();
      }

      const response = context.request.method === 'HEAD' ? new Response(null, result.response) : result.response;
      return response;
    });

    internalWorker.use(httpHandler);

    this.httpHandlerGroups.push({ interceptor, httpHandler });
  }

  clearHandlers() {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    this._internalWorker?.resetHandlers();
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

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
