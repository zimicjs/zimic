import { setupServer } from 'msw/node';

import HttpInterceptorWorker, { HttpInterceptorWorkerOptions } from './HttpInterceptorWorker';
import { NodeMSWWorker } from './types';

class NodeHttpInterceptorWorker extends HttpInterceptorWorker<NodeMSWWorker> {
  constructor(options: HttpInterceptorWorkerOptions) {
    const worker = setupServer();
    super(worker, options);
  }
}

export default NodeHttpInterceptorWorker;
