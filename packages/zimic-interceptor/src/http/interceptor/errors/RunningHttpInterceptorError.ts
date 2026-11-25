/**
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstart `interceptor.start()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstop `interceptor.stop()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorisrunning `interceptor.isRunning` API reference}
 */
class RunningHttpInterceptorError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor is running. ${additionalMessage}`);
    this.name = 'RunningHttpInterceptorError';
  }
}

export default RunningHttpInterceptorError;
