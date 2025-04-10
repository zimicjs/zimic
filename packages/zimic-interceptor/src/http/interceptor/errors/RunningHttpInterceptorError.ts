/**
 * An error thrown when the interceptor is running and some operation requires it to be stopped first.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart `interceptor.start()` API reference}
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstop `interceptor.stop()` API reference}
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorisrunning `interceptor.isRunning` API reference}
 */
class RunningHttpInterceptorError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor is running. ${additionalMessage}`);
    this.name = 'RunningHttpInterceptorError';
  }
}

export default RunningHttpInterceptorError;
