import NodeHttpInterceptorWorker from '../../interceptorWorker/NodeHttpInterceptorWorker';
import BaseHttpInterceptor from '../BaseHttpInterceptor';
import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptorSchema } from '../types/schema';

class NodeHttpInterceptor<Schema extends HttpInterceptorSchema> extends BaseHttpInterceptor<Schema> {
  constructor(options: HttpInterceptorOptions) {
    const nodeWorker = new NodeHttpInterceptorWorker(options);
    super({ ...options, worker: nodeWorker });
  }
}

export default NodeHttpInterceptor;
