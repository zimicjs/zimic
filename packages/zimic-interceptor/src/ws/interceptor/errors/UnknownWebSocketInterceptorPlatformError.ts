class UnknownWebSocketInterceptorPlatformError extends Error {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in our Vitest setup. */
  constructor() {
    super('Unknown interceptor platform.');
    this.name = 'UnknownWebSocketInterceptorPlatformError';
  }
}

export default UnknownWebSocketInterceptorPlatformError;
