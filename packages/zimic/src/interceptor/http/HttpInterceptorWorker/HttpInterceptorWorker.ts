import { HttpResponse, SharedOptions, http, passthrough } from 'msw';

import { HttpInterceptorMethod } from '../HttpInterceptor/types/schema';
import { BrowserMSWWorker, HttpRequestHandler, MSWWorker } from './types';

export interface HttpInterceptorWorkerOptions {
  baseURL: string;
}

abstract class HttpInterceptorWorker<Worker extends MSWWorker = MSWWorker> {
  private _baseURL: string;
  private _isRunning = false;

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

  isRunning() {
    return this._isRunning;
  }

  async start() {
    if (this._isRunning) {
      return;
    }

    const sharedOptions: SharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isBrowserWorker(this._worker)) {
      await this._worker.start({ ...sharedOptions, quiet: true });
      this._isRunning = true;
    } else {
      this._worker.listen(sharedOptions);
      this._isRunning = true;
    }
  }

  stop() {
    if (!this._isRunning) {
      return;
    }

    if (this.isBrowserWorker(this._worker)) {
      this._worker.stop();
      this._isRunning = false;
    } else {
      this._worker.close();
      this._isRunning = false;
    }
  }

  private isBrowserWorker(worker: MSWWorker): worker is BrowserMSWWorker {
    return 'start' in worker && 'stop' in worker;
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

        return HttpResponse.json(result.body, { status: result.status });
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
