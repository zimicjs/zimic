import { createInterceptorSavingSafeLimitExceededMessage } from '@/interceptor/errors/savingSafeLimit';

/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorrequestsaving `interceptor.requestSaving` API reference} */
class RequestSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedRequests: number, safeLimit: number) {
    super(
      createInterceptorSavingSafeLimitExceededMessage({
        resourceName: 'requests',
        optionName: 'requestSaving',
        numberOfSavedResources: numberOfSavedRequests,
        safeLimit,
        learnMoreURL: 'https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorrequestsaving',
      }),
    );
    this.name = 'RequestSavingSafeLimitExceededError';
  }
}

export default RequestSavingSafeLimitExceededError;
