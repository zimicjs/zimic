/** WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution. */
class DisabledMessageSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted messages are not being saved. ' +
        'Did you forget to use `messageSaving.enabled: true` in your interceptor?\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/create-websocket-interceptor',
    );
    this.name = 'DisabledMessageSavingError';
  }
}

export default DisabledMessageSavingError;
