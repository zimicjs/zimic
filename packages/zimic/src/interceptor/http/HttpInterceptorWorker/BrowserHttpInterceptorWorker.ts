import { setupWorker } from 'msw/browser';

import HttpInterceptorWorker, { HttpInterceptorWorkerOptions } from './HttpInterceptorWorker';
import { BrowserMSWWorker } from './types';

class BrowserHttpInterceptorWorker extends HttpInterceptorWorker<BrowserMSWWorker> {
  constructor(options?: HttpInterceptorWorkerOptions) {
    const worker = setupWorker();
    super(worker, options);
  }
}

export default BrowserHttpInterceptorWorker;
