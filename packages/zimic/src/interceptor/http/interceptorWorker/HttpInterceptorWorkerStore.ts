import { UnhandledRequestStrategy } from '../interceptor/types/options';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from './constants';

class HttpInterceptorWorkerStore {
  private static _defaultUnhandledRequestStrategy: UnhandledRequestStrategy = DEFAULT_UNHANDLED_REQUEST_STRATEGY;

  private class = HttpInterceptorWorkerStore;

  defaultUnhandledRequestStrategy() {
    return this.class._defaultUnhandledRequestStrategy;
  }

  setDefaultUnhandledRequestStrategy(strategy: UnhandledRequestStrategy) {
    this.class._defaultUnhandledRequestStrategy = strategy;
  }
}

export default HttpInterceptorWorkerStore;
