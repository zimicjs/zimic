import { HttpResponse, http, passthrough } from 'msw';

import { HttpInterceptorMethod } from '../HttpInterceptor/types/schema';
import UnknownInterceptorWorkerError from './errors/UnknownInterceptorWorkerError';
import { BrowserMSWWorker, HttpRequestHandler, MSWWorker, NodeMSWWorker } from './types';

abstract class HttpInterceptorWorker<Worker extends MSWWorker = MSWWorker> {
  protected constructor(private worker: Worker) {}

  async start() {
    if (this.isBrowserWorker(this.worker)) {
      await this.worker.start();
    } else if (this.isNodeWorker(this.worker)) {
      this.worker.listen();
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

    this.worker.use(
      http[lowercaseMethod](path, async (context) => {
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
}

export default HttpInterceptorWorker;
