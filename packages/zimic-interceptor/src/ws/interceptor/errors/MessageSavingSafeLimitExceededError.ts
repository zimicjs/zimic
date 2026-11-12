import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the safe limit of saved intercepted messages is exceeded.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
class MessageSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedMessages: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'messages',
        optionName: 'messageSaving',
        numberOfSavedResources: numberOfSavedMessages,
        safeLimit,
        learnMoreURL: 'https://zimic.dev/docs/interceptor/api/create-websocket-interceptor',
      }),
    );
    this.name = 'MessageSavingSafeLimitExceededError';
  }
}

export default MessageSavingSafeLimitExceededError;
