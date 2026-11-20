import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorconnectionsaving `interceptor.connectionSaving` API reference}
 */
class ConnectionSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedConnections: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'connections',
        optionName: 'connectionSaving',
        numberOfSavedResources: numberOfSavedConnections,
        safeLimit,
      }),
    );
    this.name = 'ConnectionSavingSafeLimitExceededError';
  }
}

export default ConnectionSavingSafeLimitExceededError;
