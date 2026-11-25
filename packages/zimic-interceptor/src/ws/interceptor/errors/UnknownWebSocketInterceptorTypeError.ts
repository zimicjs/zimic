import { ValidationError } from '@zimic/utils/validation';

import { WebSocketInterceptorType } from '../types/options';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
class UnknownWebSocketInterceptorTypeError extends ValidationError {
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
