import NodeHttpInterceptorWorker from '../../interceptorWorker/NodeHttpInterceptorWorker';
import InternalHttpInterceptor from '../InternalHttpInterceptor';
import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptorSchema } from '../types/schema';

class InternalNodeHttpInterceptor<Schema extends HttpInterceptorSchema> extends InternalHttpInterceptor<
  Schema,
  NodeHttpInterceptorWorker
> {
  constructor(options: HttpInterceptorOptions) {
    const nodeWorker = new NodeHttpInterceptorWorker(options);
    super({ ...options, worker: nodeWorker });
  }
}

export default InternalNodeHttpInterceptor;
