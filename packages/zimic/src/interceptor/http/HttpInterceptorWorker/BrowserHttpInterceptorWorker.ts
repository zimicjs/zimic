import { setupWorker } from 'msw/browser';

import HttpInterceptorWorker from './HttpInterceptorWorker';
import { BrowserMSWWorker } from './types';

class BrowserHttpInterceptorWorker extends HttpInterceptorWorker<BrowserMSWWorker> {
  constructor() {
    super(setupWorker());
  }
}

export default BrowserHttpInterceptorWorker;
