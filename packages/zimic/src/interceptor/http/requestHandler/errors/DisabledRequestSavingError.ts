/**
 * Error thrown when trying to access requests when the interceptor is not configured to do so.
 *
 * @see {@link https://github.com/zimicjs/zimic#saving-intercepted-requests Saving intercepted requests}
 */
class DisabledRequestSavingError extends TypeError {
  constructor() {
    super(
      'Intercepted requests are not saved by default. ' +
        'Did you forget to use `saveRequests: true` when creating the interceptor?\n\n' +
        'Learn more: https://github.com/zimicjs/zimic#saving-intercepted-requests',
    );
    this.name = 'DisabledRequestSavingError';
  }
}

export default DisabledRequestSavingError;
