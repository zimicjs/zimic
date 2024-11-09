import { HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from './constants';

class HttpInterceptorWorkerStore {
  private static _defaultOnUnhandledRequest: {
    local: UnhandledRequestStrategy.Local;
    remote: UnhandledRequestStrategy.Remote;
  } = { ...DEFAULT_UNHANDLED_REQUEST_STRATEGY };

  private class = HttpInterceptorWorkerStore;

  defaultOnUnhandledRequest(interceptorType: 'local'): UnhandledRequestStrategy.Local;
  defaultOnUnhandledRequest(interceptorType: 'remote'): UnhandledRequestStrategy.Remote;
  defaultOnUnhandledRequest(interceptorType: HttpInterceptorType): UnhandledRequestStrategy;
  defaultOnUnhandledRequest(interceptorType: HttpInterceptorType) {
    return this.class._defaultOnUnhandledRequest[interceptorType];
  }

  setDefaultOnUnhandledRequest(interceptorType: 'local', strategy: UnhandledRequestStrategy.Local): void;
  setDefaultOnUnhandledRequest(interceptorType: 'remote', strategy: UnhandledRequestStrategy.Remote): void;
  setDefaultOnUnhandledRequest(interceptorType: HttpInterceptorType, strategy: UnhandledRequestStrategy): void;
  setDefaultOnUnhandledRequest(interceptorType: HttpInterceptorType, strategy: UnhandledRequestStrategy) {
    if (interceptorType === 'local') {
      this.class._defaultOnUnhandledRequest[interceptorType] = strategy as UnhandledRequestStrategy.Local;
    } else {
      this.class._defaultOnUnhandledRequest[interceptorType] = strategy as UnhandledRequestStrategy.Remote;
    }
  }
}

export default HttpInterceptorWorkerStore;
