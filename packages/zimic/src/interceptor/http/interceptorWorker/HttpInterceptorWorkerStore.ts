import { HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from './constants';

class HttpInterceptorWorkerStore {
  private static _defaultOnUnhandledRequest: {
    local: UnhandledRequestStrategy.LocalSync;
    remote: UnhandledRequestStrategy.Remote;
  } = {
    local: { ...DEFAULT_UNHANDLED_REQUEST_STRATEGY.local },
    remote: { ...DEFAULT_UNHANDLED_REQUEST_STRATEGY.remote },
  };

  private class = HttpInterceptorWorkerStore;

  defaultOnUnhandledRequest(interceptorType: 'local'): UnhandledRequestStrategy.LocalSync;
  defaultOnUnhandledRequest(interceptorType: 'remote'): UnhandledRequestStrategy.Remote;
  defaultOnUnhandledRequest(interceptorType: HttpInterceptorType): UnhandledRequestStrategy;
  defaultOnUnhandledRequest(interceptorType: HttpInterceptorType) {
    return this.class._defaultOnUnhandledRequest[interceptorType];
  }

  setDefaultOnUnhandledRequest(interceptorType: 'local', strategy: UnhandledRequestStrategy.LocalSync): void;
  setDefaultOnUnhandledRequest(interceptorType: 'remote', strategy: UnhandledRequestStrategy.Remote): void;
  setDefaultOnUnhandledRequest(interceptorType: HttpInterceptorType, strategy: UnhandledRequestStrategy): void;
  setDefaultOnUnhandledRequest(interceptorType: HttpInterceptorType, strategy: UnhandledRequestStrategy) {
    if (interceptorType === 'local') {
      this.class._defaultOnUnhandledRequest[interceptorType] = strategy as UnhandledRequestStrategy.LocalSync;
    } else {
      this.class._defaultOnUnhandledRequest[interceptorType] = strategy as UnhandledRequestStrategy.Remote;
    }
  }
}

export default HttpInterceptorWorkerStore;
