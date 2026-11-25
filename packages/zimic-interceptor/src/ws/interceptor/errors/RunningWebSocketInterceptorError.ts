/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when the interceptor is running and some operation requires it to be stopped first.
 */
class RunningWebSocketInterceptorError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor is running. ${additionalMessage}`);
    this.name = 'RunningWebSocketInterceptorError';
  }
}

export default RunningWebSocketInterceptorError;
