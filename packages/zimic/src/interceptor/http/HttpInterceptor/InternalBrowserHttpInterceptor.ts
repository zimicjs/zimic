import BrowserHttpInterceptor from './BrowserHttpInterceptor';
import { HttpInterceptorSchema } from './types/schema';

class InternalBrowserHttpInterceptor<Schema extends HttpInterceptorSchema> extends BrowserHttpInterceptor<Schema> {
  worker() {
    return this._worker;
  }
}

export default InternalBrowserHttpInterceptor;
