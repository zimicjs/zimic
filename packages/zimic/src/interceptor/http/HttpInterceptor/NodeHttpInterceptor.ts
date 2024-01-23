import NodeHttpInterceptorWorker from '../HttpInterceptorWorker/NodeHttpInterceptorWorker';
import HttpInterceptor from './HttpInterceptor';
import { HttpInterceptorOptions } from './types/options';
import { HttpInterceptorSchema } from './types/schema';

class NodeHttpInterceptor<Schema extends HttpInterceptorSchema> extends HttpInterceptor<Schema> {
  constructor(options: HttpInterceptorOptions) {
    const nodeWorker = new NodeHttpInterceptorWorker(options);
    super({ ...options, worker: nodeWorker });
  }
}

export default NodeHttpInterceptor;
