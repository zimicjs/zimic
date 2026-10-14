/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when trying to access messages when the interceptor is not configured to save them.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-websocket-interceptor `createWebSocketInterceptor()` API reference}
 */
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
