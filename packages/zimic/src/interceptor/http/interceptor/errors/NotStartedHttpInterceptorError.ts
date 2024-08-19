/**
 * An error thrown when the interceptor is not running and it's not possible to use the mocking utilities.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api-zimic-interceptor-http#http-interceptorstart `interceptor.start()` API reference}
 * @see {@link https://github.com/zimicjs/zimic/wiki/api-zimic-interceptor-http#http-interceptorstop `interceptor.stop()` API reference}
 * @see {@link https://github.com/zimicjs/zimic/wiki/api-zimic-interceptor-http#http-interceptorisrunning `interceptor.isRunning()` API reference}
 */
class NotStartedHttpInterceptorError extends Error {
  constructor() {
    super('Interceptor is not running. Did you forget to call `await interceptor.start()`?');
    this.name = 'NotStartedHttpInterceptorError';
  }
}

export default NotStartedHttpInterceptorError;
