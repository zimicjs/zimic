import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the safe limit of saved intercepted messages is exceeded.
 */
class MessageSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedMessages: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'messages',
        optionName: 'messageSaving',
        numberOfSavedResources: numberOfSavedMessages,
        safeLimit,
      }),
    );
    this.name = 'MessageSavingSafeLimitExceededError';
  }
}

export default MessageSavingSafeLimitExceededError;
