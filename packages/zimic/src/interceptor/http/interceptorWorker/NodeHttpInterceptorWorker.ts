import { setupServer } from 'msw/node';

import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerOptions, NodeHttpWorker } from './types';

class NodeHttpInterceptorWorker extends HttpInterceptorWorker<NodeHttpWorker> {
  constructor(options: HttpInterceptorWorkerOptions) {
    const worker = setupServer();
    super(worker, options);
  }
}

export default NodeHttpInterceptorWorker;
