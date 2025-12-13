class UnsupportedBypassedResponseError extends Error {
  constructor() {
    super(
      "Interceptor servers cannot bypass responses. When using remote interceptors, use `{ action: 'reject' }` instead " +
        "of `{ action: 'bypass' }`.\n\n" +
        'Learn more: https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond',
    );
    this.name = 'UnsupportedBypassedResponseError';
  }
}

export default UnsupportedBypassedResponseError;
