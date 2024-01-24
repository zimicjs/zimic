import { HttpInterceptorSchema } from '../types/schema';
import BrowserHttpInterceptor from './BrowserHttpInterceptor';

class InternalBrowserHttpInterceptor<Schema extends HttpInterceptorSchema> extends BrowserHttpInterceptor<Schema> {
  worker() {
    return this._worker;
  }
}

export default InternalBrowserHttpInterceptor;
