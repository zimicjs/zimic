class NotRunningWebSocketInterceptorError extends Error {
  constructor() {
    super('Interceptor is not running. Did you forget to call `await interceptor.start()`?');
    this.name = 'NotRunningWebSocketInterceptorError';
  }
}

export default NotRunningWebSocketInterceptorError;
