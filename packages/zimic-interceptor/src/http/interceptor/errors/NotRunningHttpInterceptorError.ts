/**
 * An error thrown when the interceptor is not running and it's not possible to use the mocking utilities.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstart `interceptor.start()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorstop `interceptor.stop()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorisrunning `interceptor.isRunning` API reference}
 */
class NotRunningHttpInterceptorError extends Error {
  constructor() {
    super('Interceptor is not running. Did you forget to call `await interceptor.start()`?');
    this.name = 'NotRunningHttpInterceptorError';
  }
}

export default NotRunningHttpInterceptorError;
