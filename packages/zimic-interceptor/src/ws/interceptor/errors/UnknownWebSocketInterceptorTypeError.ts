import { WebSocketInterceptorType } from '../types/options';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when an unknown interceptor type is used. Currently, the types `local` and `remote` are supported.
 */
class UnknownWebSocketInterceptorTypeError extends TypeError {
  constructor(unknownType: unknown) {
    super(
      `Unknown WebSocket interceptor type: ${unknownType}. The available options are ` +
        `'${'local' satisfies WebSocketInterceptorType}' and ` +
        `'${'remote' satisfies WebSocketInterceptorType}'.`,
    );
    this.name = 'UnknownWebSocketInterceptorTypeError';
  }
}

export default UnknownWebSocketInterceptorTypeError;
