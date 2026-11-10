import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/**
 * Error thrown when the safe limit of saved intercepted requests is exceeded.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference}
 */
class RequestSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedRequests: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'requests',
        optionName: 'requestSaving',
        numberOfSavedResources: numberOfSavedRequests,
        safeLimit,
        learnMoreURL: 'https://zimic.dev/docs/interceptor/api/create-http-interceptor',
      }),
    );
    this.name = 'RequestSavingSafeLimitExceededError';
  }
}

export default RequestSavingSafeLimitExceededError;
