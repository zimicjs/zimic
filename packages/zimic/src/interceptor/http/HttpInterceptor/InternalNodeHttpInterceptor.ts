import NodeHttpInterceptor from './NodeHttpInterceptor';
import { HttpInterceptorSchema } from './types/schema';

class InternalNodeHttpInterceptor<Schema extends HttpInterceptorSchema> extends NodeHttpInterceptor<Schema> {
  worker() {
    return this._worker;
  }
}

export default InternalNodeHttpInterceptor;
