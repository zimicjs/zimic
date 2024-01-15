import HttpInterceptorWorker from '../HttpInterceptorWorker';
import HttpRequestTracker from '../HttpRequestTracker';
import { HttpInterceptorMethodHandler } from './types/handlers';
import { HttpInterceptorContext, HttpInterceptorOptions } from './types/options';
import { HttpInterceptorSchema } from './types/schema';

abstract class HttpInterceptor<Schema extends HttpInterceptorSchema, Worker extends HttpInterceptorWorker> {
  private context: HttpInterceptorContext<Worker>;

  constructor(options: HttpInterceptorOptions & { worker: Worker }) {
    this.context = {
      worker: options.worker,
      baseURL: options.baseURL,
    };
  }

  async start() {
    await this.context.worker.start();
  }

  stop() {
    this.context.worker.stop();
  }

  get: HttpInterceptorMethodHandler<Schema, 'GET'> = (path) => {
    return new HttpRequestTracker(this.context, 'GET', path);
  };

  post: HttpInterceptorMethodHandler<Schema, 'POST'> = (path) => {
    return new HttpRequestTracker(this.context, 'POST', path);
  };

  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'> = (path) => {
    return new HttpRequestTracker(this.context, 'PATCH', path);
  };

  put: HttpInterceptorMethodHandler<Schema, 'PUT'> = (path) => {
    return new HttpRequestTracker(this.context, 'PUT', path);
  };

  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'> = (path) => {
    return new HttpRequestTracker(this.context, 'DELETE', path);
  };

  head: HttpInterceptorMethodHandler<Schema, 'HEAD'> = (path) => {
    return new HttpRequestTracker(this.context, 'HEAD', path);
  };

  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'> = (path) => {
    return new HttpRequestTracker(this.context, 'OPTIONS', path);
  };
}

export default HttpInterceptor;
