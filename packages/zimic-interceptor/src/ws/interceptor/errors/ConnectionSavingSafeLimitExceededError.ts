import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the safe limit of saved intercepted connections is exceeded.
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
