/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorconnectionsaving `interceptor.connectionSaving` API reference}
 */
class DisabledConnectionSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted connections are not being saved. ' +
        'Did you forget to use `connectionSaving.enabled: true` in your interceptor?\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/websocket-interceptor#interceptorconnectionsaving',
    );
    this.name = 'DisabledConnectionSavingError';
  }
}

export default DisabledConnectionSavingError;
