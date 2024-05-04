/* istanbul ignore next -- @preserve
 * This error is a fallback to prevent doing operations without a started server. It should not happen in normal
 * conditions.
 */
class NotStartedServerError extends Error {
  constructor() {
    super('The server is not running.');
    this.name = 'NotStartedServerError';
  }
}

export default NotStartedServerError;
