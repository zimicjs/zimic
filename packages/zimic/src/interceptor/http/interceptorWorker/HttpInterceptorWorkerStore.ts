import { UnhandledRequestStrategy } from '../interceptor/types/options';

export type DefaultUnhandledRequestStrategy =
  | Required<UnhandledRequestStrategy.Declaration>
  | UnhandledRequestStrategy.Handler;

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY: Required<UnhandledRequestStrategy.Declaration> = Object.freeze({
  log: true,
});

class HttpInterceptorWorkerStore {
  private static _defaultUnhandledRequestStrategy: DefaultUnhandledRequestStrategy = {
    ...DEFAULT_UNHANDLED_REQUEST_STRATEGY,
  };

  private class = HttpInterceptorWorkerStore;

  defaultUnhandledRequestStrategy() {
    return this.class._defaultUnhandledRequestStrategy;
  }

  setDefaultUnhandledRequestStrategy(strategy: UnhandledRequestStrategy) {
    this.class._defaultUnhandledRequestStrategy =
      typeof strategy === 'function'
        ? strategy
        : {
            log: strategy.log ?? DEFAULT_UNHANDLED_REQUEST_STRATEGY.log,
          };
  }
}

export default HttpInterceptorWorkerStore;
