import { UnhandledRequestStrategy } from '../interceptor/types/options';

const DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY = process.env.DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY === 'true';

export type DefaultUnhandledRequestStrategy =
  | Required<UnhandledRequestStrategy.Declaration>
  | UnhandledRequestStrategy.Handler;

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY: Required<UnhandledRequestStrategy.Declaration> = Object.freeze({
  log: DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY,
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
