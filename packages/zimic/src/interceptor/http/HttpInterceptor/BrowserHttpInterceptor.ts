import BrowserHttpInterceptorWorker from '../HttpInterceptorWorker/BrowserHttpInterceptorWorker';
import HttpInterceptor from './HttpInterceptor';
import { HttpInterceptorOptions } from './types/options';
import { HttpInterceptorSchema } from './types/schema';

class BrowserHttpInterceptor<Schema extends HttpInterceptorSchema> extends HttpInterceptor<Schema> {
  constructor(options: HttpInterceptorOptions) {
    const browserWorker = new BrowserHttpInterceptorWorker(options);
    super({ ...options, worker: browserWorker });
  }
}

export default BrowserHttpInterceptor;
