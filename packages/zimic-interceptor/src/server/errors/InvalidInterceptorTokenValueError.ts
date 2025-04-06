/**
 * Error thrown when an interceptor token value is invalid.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenValueError extends Error {
  constructor(tokenValue: string) {
    super(`Invalid interceptor token value: ${tokenValue}`);
    this.name = 'InvalidInterceptorTokenValueError';
  }
}

export default InvalidInterceptorTokenValueError;
