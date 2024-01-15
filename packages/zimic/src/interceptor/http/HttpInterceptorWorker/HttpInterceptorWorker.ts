import { HttpResponseResolver, http } from 'msw';

import { HttpInterceptorMethod } from '../HttpInterceptor/types/schema';
import UnknownInterceptorWorkerError from './errors/UnknownInterceptorWorkerError';
import { BrowserMSWWorker, MSWWorker, NodeMSWWorker } from './types';

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

  use(method: Lowercase<HttpInterceptorMethod>, path: string, handler: HttpResponseResolver) {
    this.worker.use(http[method](path, handler));
  }
}

export default HttpInterceptorWorker;
