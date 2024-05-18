/** Error thrown when the worker is not running and it's not possible to declare mock responses. */
class NotStartedHttpInterceptorError extends Error {
  constructor() {
    super('[zimic] Interceptor is not running. Did you forget to call `await interceptor.start()`?');
    this.name = 'NotStartedHttpInterceptorError';
  }
}

export default NotStartedHttpInterceptorError;
