/** @see {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorrequestsaving `interceptor.requestSaving` API reference} */
class DisabledRequestSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted requests are not being saved. ' +
        'Did you forget to use `requestSaving.enabled: true` in your interceptor?\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorrequestsaving',
    );
    this.name = 'DisabledRequestSavingError';
  }
}

export default DisabledRequestSavingError;
