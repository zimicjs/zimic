import { HttpInterceptorSchema } from '../types/schema';
import NodeHttpInterceptor from './NodeHttpInterceptor';

class InternalNodeHttpInterceptor<Schema extends HttpInterceptorSchema> extends NodeHttpInterceptor<Schema> {
  worker() {
    return this._worker;
  }
}

export default InternalNodeHttpInterceptor;
