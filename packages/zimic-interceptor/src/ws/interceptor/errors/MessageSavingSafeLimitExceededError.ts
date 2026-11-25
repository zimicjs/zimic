import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessagesaving `interceptor.messageSaving` API reference}
 */
class MessageSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedMessages: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'messages',
        optionName: 'messageSaving',
        numberOfSavedResources: numberOfSavedMessages,
        safeLimit,
        learnMoreURL: 'https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptormessagesaving',
      }),
    );
    this.name = 'MessageSavingSafeLimitExceededError';
  }
}

export default MessageSavingSafeLimitExceededError;
