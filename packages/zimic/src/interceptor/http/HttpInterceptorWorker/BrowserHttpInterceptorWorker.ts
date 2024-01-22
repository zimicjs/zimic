import { setupWorker } from 'msw/browser';

import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerOptions, BrowserHttpWorker } from './types';

class BrowserHttpInterceptorWorker extends HttpInterceptorWorker<BrowserHttpWorker> {
  constructor(options: HttpInterceptorWorkerOptions) {
    const worker = setupWorker();
    super(worker, options);
  }
}

export default BrowserHttpInterceptorWorker;
