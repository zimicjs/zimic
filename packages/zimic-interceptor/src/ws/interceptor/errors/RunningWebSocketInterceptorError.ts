/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorstart `interceptor.start()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorstop `interceptor.stop()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorisrunning `interceptor.isRunning` API reference}
 */
class RunningWebSocketInterceptorError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor is running. ${additionalMessage}`);
    this.name = 'RunningWebSocketInterceptorError';
  }
}

export default RunningWebSocketInterceptorError;
