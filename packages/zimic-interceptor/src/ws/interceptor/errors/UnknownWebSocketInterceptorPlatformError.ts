import { ValidationError } from '@zimic/utils/validation';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when an unknown interceptor platform is detected. Currently, the platforms `node` and `browser` are
 * supported.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorplatform `interceptor.platform` API reference}
 */
class UnknownWebSocketInterceptorPlatformError extends ValidationError {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in our Vitest setup. */
  constructor() {
    super('Unknown interceptor platform.');
    this.name = 'UnknownWebSocketInterceptorPlatformError';
  }
}

export default UnknownWebSocketInterceptorPlatformError;
