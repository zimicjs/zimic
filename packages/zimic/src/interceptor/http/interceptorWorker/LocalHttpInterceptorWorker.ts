import { HttpHandler as MSWHttpHandler, SharedOptions as MSWWorkerSharedOptions, http, passthrough } from 'msw';
import * as mswBrowser from 'msw/browser';
import { UnhandledRequestPrint } from 'msw/lib/core/utils/request/onUnhandledRequest';
import * as mswNode from 'msw/node';

import { HttpRequest, HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpSchema } from '@/http/types/schema';
import { createURL, ensureUniquePathParams, excludeNonPathParams } from '@/utils/urls';

import NotStartedHttpInterceptorError from '../interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
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

  internalWorkerOrCreate() {
    if (!this._internalWorker) {
      this._internalWorker = this.createInternalWorker();
    }
    return this._internalWorker;
  }

  private createInternalWorker() {
    if (typeof mswNode.setupServer !== 'undefined') {
      return mswNode.setupServer();
    }

    /* istanbul ignore else -- @preserve */
    if (typeof mswBrowser.setupWorker !== 'undefined') {
      return mswBrowser.setupWorker();
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async start() {
    await super.sharedStart(async () => {
      const internalWorker = this.internalWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: (request, print) => {
          const { originalDefaultStrategy, customDefaultStrategy, customStrategy } = super.getUnhandledRequestStrategy(
            request,
            'local',
          );

          const strategy: UnhandledRequestStrategy.Declaration = {
            ...originalDefaultStrategy,
            ...customDefaultStrategy,
            ...customStrategy,
          };

          // MSW does not support async callbacks for `onUnhandledRequest`.
          // As a workaround, we can only support synchronous code.
          void super.handleUnhandledRequest(request, strategy);

          if (strategy.action === 'reject') {
            this.rejectGlobalUnhandledRequest(print);
          }
        },
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

  private rejectGlobalUnhandledRequest(print: UnhandledRequestPrint): never {
    let InternalError: ErrorConstructor | null = null;
    const originalConsoleError = console.error;

    try {
      // Ignore calls to `console.error`.
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      console.error = () => {};

      // `print.error()` throws an InternalError that is not exposed in the public API of MSW.
      // We need to catch it and rethrow it as a custom error.
      print.error();
    } catch (error) {
      if (error instanceof Error) {
        InternalError = error.constructor as ErrorConstructor;
      }
    } finally {
      console.error = originalConsoleError;
    }

    if (!InternalError) {
      throw new Error(
        `Could not properly reject an unhandled request: InternalError is ${InternalError}.\n` +
          'This is likely a bug in Zimic. Please fill in an issue.',
      );
    }

    class RejectedUnhandledRequestError extends InternalError {
      constructor() {
        super('Request was not handled and was rejected.');
        this.name = 'RejectedUnhandledRequestError';
      }
    }

    throw new RejectedUnhandledRequestError();
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
      const request = context.request as HttpRequest;
      const requestClone = request.clone();

      let result: HttpResponseFactoryResult | null = null;

      try {
        result = await createResponse({ ...context, request });
      } catch (error) {
        console.error(error);
      }

      if (!result?.response) {
        const { originalDefaultStrategy, customDefaultStrategy, customStrategy } = super.getUnhandledRequestStrategy(
          requestClone,
          'local',
        );

        const strategy: UnhandledRequestStrategy.Declaration = {
          ...originalDefaultStrategy,
          ...customDefaultStrategy,
          ...customStrategy,
        };

        if (strategy.action === 'reject') {
          return Response.error();
        } else {
          return passthrough();
        }
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
