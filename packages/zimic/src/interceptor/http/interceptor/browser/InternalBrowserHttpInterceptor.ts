import BrowserHttpInterceptorWorker from '../../interceptorWorker/BrowserHttpInterceptorWorker';
import InternalHttpInterceptor from '../InternalHttpInterceptor';
import { HttpInterceptorOptions } from '../types/options';
import { HttpInterceptorSchema } from '../types/schema';

class InternalBrowserHttpInterceptor<Schema extends HttpInterceptorSchema> extends InternalHttpInterceptor<
  Schema,
  BrowserHttpInterceptorWorker
> {
  constructor(options: HttpInterceptorOptions) {
    const browserWorker = new BrowserHttpInterceptorWorker(options);
    super({ ...options, worker: browserWorker });
  }
}

export default InternalBrowserHttpInterceptor;
