import {
  HttpHandler as MSWHttpHandler,
  SharedOptions as MSWWorkerSharedOptions,
  StrictRequest as MSWStrictRequest,
  http,
  passthrough,
} from 'msw';

import { HttpBody } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { excludeDynamicParams } from '@/utils/fetch';

import NotStartedHttpInterceptorError from '../interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from '../interceptor/errors/UnknownHttpInterceptorPlatform';
import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions } from './types/options';
import { BrowserHttpWorker, HttpResponseFactory, HttpWorker, NodeHttpWorker } from './types/requests';

class LocalHttpInterceptorWorker extends HttpInterceptorWorker {
  readonly type: 'local';

  private _internalWorker?: HttpWorker;

  private httpHandlerGroups: {
    interceptor: HttpInterceptorClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    httpHandler: MSWHttpHandler;
  }[] = [];

  constructor(options: LocalHttpInterceptorWorkerOptions) {
    super();
    this.type = options.type;
  }

  internalWorkerOrThrow() {
    if (!this._internalWorker) {
      throw new NotStartedHttpInterceptorError();
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
    /* istanbul ignore else -- @preserve */
    if (typeof setupWorker !== 'undefined') {
      return setupWorker();
    }

    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is currently not possible in our Vitest setup. */
    throw new UnknownHttpInterceptorPlatform();
  }

  async start() {
    if (super.isRunning()) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();
    const sharedOptions: MSWWorkerSharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isInternalBrowserWorker(internalWorker)) {
      super.setPlatform('browser');
      await this.startInBrowser(internalWorker, sharedOptions);
    } else {
      super.setPlatform('node');
      this.startInNode(internalWorker, sharedOptions);
    }

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

    this._internalWorker = undefined;
    super.setIsRunning(false);
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
    rawURL: string,
    createResponse: HttpResponseFactory,
  ) {
    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const url = excludeDynamicParams(new URL(rawURL)).toString();

    const httpHandler = http[lowercaseMethod](url, async (context) => {
      const result = await createResponse({
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
    const internalWorker = this.internalWorkerOrThrow();
    internalWorker.resetHandlers();
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
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
