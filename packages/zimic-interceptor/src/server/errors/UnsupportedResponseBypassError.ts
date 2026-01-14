class UnsupportedResponseBypassError extends Error {
  constructor() {
    super(
      "Remote interceptors cannot bypass responses. Use `{ action: 'reject' }` instead.\n\n" +
        'Learn more: https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond',
    );
    this.name = 'UnsupportedResponseBypassError';
  }
}

export default UnsupportedResponseBypassError;
