import { HttpResponse, SharedOptions, http, passthrough } from 'msw';

import { HttpInterceptorMethod } from '../HttpInterceptor/types/schema';
import UnknownInterceptorWorkerError from './errors/UnknownInterceptorWorkerError';
import { BrowserMSWWorker, HttpRequestHandler, MSWWorker, NodeMSWWorker } from './types';

export interface HttpInterceptorWorkerOptions {
  baseURL?: string;
}

abstract class HttpInterceptorWorker<Worker extends MSWWorker = MSWWorker> {
  private baseURL?: string;

  protected constructor(
    private worker: Worker,
    options: HttpInterceptorWorkerOptions = {},
  ) {
    this.baseURL = options.baseURL;
  }

  async start() {
    const sharedOptions: SharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isBrowserWorker(this.worker)) {
      await this.worker.start(sharedOptions);
    } else if (this.isNodeWorker(this.worker)) {
      this.worker.listen(sharedOptions);
    } else {
      throw new UnknownInterceptorWorkerError(this.worker);
    }
  }

  stop() {
    if (this.isBrowserWorker(this.worker)) {
      this.worker.stop();
    } else if (this.isNodeWorker(this.worker)) {
      this.worker.close();
    } else {
      throw new UnknownInterceptorWorkerError(this.worker);
    }
  }

  private isBrowserWorker(worker: MSWWorker): worker is BrowserMSWWorker {
    return 'start' in worker;
  }

  private isNodeWorker(worker: MSWWorker): worker is NodeMSWWorker {
    return 'listen' in worker;
  }

  use(method: HttpInterceptorMethod, path: string, handler: HttpRequestHandler) {
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const pathWithBaseURL = this.applyBaseURL(path);

    this.worker.use(
      http[lowercaseMethod](pathWithBaseURL, async (context) => {
        const result = await handler(context);

        if (result.bypass) {
          return passthrough();
        }

        return HttpResponse.json(result.body, {
          status: result.status ?? 200,
        });
      }),
    );
  }

  private applyBaseURL(path: string) {
    if (this.baseURL) {
      const separator = this.baseURL.endsWith('/') || path.startsWith('/') ? '' : '/';
      return `${this.baseURL}${separator}${path}`;
    }
    return path;
  }
}

export default HttpInterceptorWorker;
