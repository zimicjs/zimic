/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when trying to access connections when the interceptor is not configured to save them.
 */
class DisabledConnectionSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted connections are not being saved. ' +
        'Did you forget to use `connectionSaving.enabled: true` in your interceptor?',
    );
    this.name = 'DisabledConnectionSavingError';
  }
}

export default DisabledConnectionSavingError;
