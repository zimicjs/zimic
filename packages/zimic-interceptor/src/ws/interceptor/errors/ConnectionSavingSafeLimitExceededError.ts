/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the safe limit of saved intercepted connections is exceeded.
 */
class ConnectionSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedConnections: number, safeLimit: number) {
    super(
      `The number of intercepted connections saved in memory (${numberOfSavedConnections}) exceeded the safe limit ` +
        `of ${safeLimit}. Did you forget to call \`interceptor.clear()\`?\n\n` +
        'If you need to save connections, make sure to regularly call `interceptor.clear()`. Alternatively, you can ' +
        'hide this warning by increasing `connectionSaving.safeLimit` in your interceptor. Note that saving too many ' +
        'connections in memory can lead to performance issues.\n\n' +
        'If you do not need to save connections, consider setting `connectionSaving.enabled: false` in your ' +
        'interceptor.',
    );
    this.name = 'ConnectionSavingSafeLimitExceededError';
  }
}

export default ConnectionSavingSafeLimitExceededError;
