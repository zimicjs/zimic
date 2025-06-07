/**
 * Error thrown when trying to access requests when the interceptor is not configured to do so.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor` API reference}
 */
class DisabledRequestSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted requests are not being saved. ' +
        'Did you forget to use `requestSaving.enabled: true` in your interceptor?\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/create-http-interceptor',
    );
    this.name = 'DisabledRequestSavingError';
  }
}

export default DisabledRequestSavingError;
