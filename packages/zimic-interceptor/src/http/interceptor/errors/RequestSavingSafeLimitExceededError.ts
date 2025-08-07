/**
 * Error thrown when the safe limit of saved intercepted requests is exceeded.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference}
 */
class RequestSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedRequests: number, safeLimit: number) {
    super(
      `The number of intercepted requests saved in memory (${numberOfSavedRequests}) exceeded the safe limit of ` +
        `${safeLimit}. Did you forget to call \`interceptor.clear()\`?\n\n` +
        'If you need to save requests, make sure to regularly call `interceptor.clear()`. Alternatively, you can ' +
        'hide this warning by increasing `requestSaving.safeLimit` in your interceptor. Note that saving too many ' +
        'requests in memory can lead to performance issues.\n\n' +
        'If you do not need to save requests, consider setting `requestSaving.enabled: false` in your ' +
        'interceptor.\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/create-http-interceptor',
    );
    this.name = 'RequestSavingSafeLimitExceededError';
  }
}

export default RequestSavingSafeLimitExceededError;
