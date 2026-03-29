/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
class UnknownWebSocketInterceptorPlatformError extends Error {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in our Vitest setup. */
  constructor() {
    super('Unknown interceptor platform.');
    this.name = 'UnknownWebSocketInterceptorPlatformError';
  }
}

export default UnknownWebSocketInterceptorPlatformError;
