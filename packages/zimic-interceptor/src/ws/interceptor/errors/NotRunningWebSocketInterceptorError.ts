/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
class NotRunningWebSocketInterceptorError extends Error {
  constructor() {
    super('Interceptor is not running. Did you forget to call `await interceptor.start()`?');
    this.name = 'NotRunningWebSocketInterceptorError';
  }
}

export default NotRunningWebSocketInterceptorError;
