import { HttpResponse, SharedOptions, http, passthrough } from 'msw';

import { HttpInterceptorMethod } from '../HttpInterceptor/types/schema';
import UnknownInterceptorWorkerError from './errors/UnknownInterceptorWorkerError';
import { BrowserMSWWorker, HttpRequestHandler, MSWWorker, NodeMSWWorker } from './types';

export interface HttpInterceptorWorkerOptions {
  baseURL: string;
}

abstract class HttpInterceptorWorker<Worker extends MSWWorker = MSWWorker> {
  private _baseURL: string;
  private isRunning = false;

  protected constructor(
    private _worker: Worker,
    options: HttpInterceptorWorkerOptions,
  ) {
    this._baseURL = options.baseURL;
  }

  worker() {
    return this._worker;
  }

  baseURL() {
    return this._baseURL;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    const sharedOptions: SharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isBrowserWorker(this._worker)) {
      await this._worker.start({ ...sharedOptions, quiet: true });
    } else if (this.isNodeWorker(this._worker)) {
      this._worker.listen(sharedOptions);
    } else {
      throw new UnknownInterceptorWorkerError(this._worker);
    }

    this.isRunning = true;
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.isBrowserWorker(this._worker)) {
      this._worker.stop();
    } else if (this.isNodeWorker(this._worker)) {
      this._worker.close();
    } else {
      throw new UnknownInterceptorWorkerError(this._worker);
    }

    this.isRunning = false;
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

    this._worker.use(
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
    const baseURLWithoutTrailingSlash = this._baseURL.replace(/\/$/, '');
    const pathWithoutLeadingSlash = path.replace(/^\//, '');
    return `${baseURLWithoutTrailingSlash}/${pathWithoutLeadingSlash}`;
  }
}

export default HttpInterceptorWorker;
