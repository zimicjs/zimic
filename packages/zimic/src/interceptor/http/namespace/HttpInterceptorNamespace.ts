import { createHttpInterceptor } from '../interceptor/factory';
import { UnhandledRequestStrategy } from '../interceptor/types/options';
import HttpInterceptorWorkerStore from '../interceptorWorker/HttpInterceptorWorkerStore';
import {
  HttpInterceptorNamespace as PublicHttpInterceptorNamespace,
  HttpInterceptorNamespaceDefault as PublicHttpInterceptorNamespaceDefault,
} from './types';

export class HttpInterceptorNamespaceDefault implements PublicHttpInterceptorNamespaceDefault {
  private store = new HttpInterceptorWorkerStore();

  onUnhandledRequest(strategy: UnhandledRequestStrategy) {
    this.store.setDefaultUnhandledRequestStrategy(strategy);
  }
}

class HttpInterceptorNamespace implements PublicHttpInterceptorNamespace {
  createInterceptor = createHttpInterceptor;

  default = Object.freeze(new HttpInterceptorNamespaceDefault());
}

export default HttpInterceptorNamespace;
