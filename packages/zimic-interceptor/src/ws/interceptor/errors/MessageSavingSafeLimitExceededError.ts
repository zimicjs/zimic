class MessageSavingSafeLimitExceededError extends TypeError {
  constructor(numberOfSavedMessages: number, safeLimit: number) {
    super(
      `The number of intercepted messages saved in memory (${numberOfSavedMessages}) exceeded the safe limit of ` +
        `${safeLimit}. Did you forget to call \`interceptor.clear()\`?\n\n` +
        'If you need to save messages, make sure to regularly call `interceptor.clear()`. Alternatively, you can ' +
        'hide this warning by increasing `messageSaving.safeLimit` in your interceptor. Note that saving too many ' +
        'messages in memory can lead to performance issues.\n\n' +
        'If you do not need to save messages, consider setting `messageSaving.enabled: false` in your ' +
        'interceptor.\n\n' +
        'Learn more: https://zimic.dev/docs/interceptor/api/create-websocket-interceptor',
    );
    this.name = 'MessageSavingSafeLimitExceededError';
  }
}

export default MessageSavingSafeLimitExceededError;
