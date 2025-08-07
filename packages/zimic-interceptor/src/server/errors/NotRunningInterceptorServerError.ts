/* istanbul ignore next -- @preserve */
/** An error thrown when the interceptor server is not running. */
class NotRunningInterceptorServerError extends Error {
  constructor() {
    super('The interceptor server is not running. Did you forget to start it?');
    this.name = 'NotRunningInterceptorServerError';
  }
}

export default NotRunningInterceptorServerError;
