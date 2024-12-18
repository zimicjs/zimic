/* istanbul ignore next -- @preserve */
/** An error thrown when the interceptor server is not running. */
class NotStartedInterceptorServerError extends Error {
  constructor() {
    super('The interceptor server is not running.');
    this.name = 'NotStartedInterceptorServerError';
  }
}

export default NotStartedInterceptorServerError;
