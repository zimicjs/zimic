class UnsupportedResponseBypassError extends Error {
  constructor() {
    super(
      "Interceptor servers cannot bypass responses. Use `{ action: 'reject' }` to reject unhandled requests instead.\n\n" +
        'Learn more: https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond',
    );
    this.name = 'UnsupportedResponseBypassError';
  }
}

export default UnsupportedResponseBypassError;
