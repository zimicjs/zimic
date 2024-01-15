import { setupServer } from 'msw/node';

import HttpInterceptorWorker from './HttpInterceptorWorker';
import { NodeMSWWorker } from './types';

class NodeHttpInterceptorWorker extends HttpInterceptorWorker<NodeMSWWorker> {
  constructor() {
    super(setupServer());
  }
}

export default NodeHttpInterceptorWorker;
