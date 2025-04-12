/**
 * Error thrown when an interceptor token is invalid.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenError extends Error {
  constructor(tokenId: string) {
    super(`Invalid interceptor token: ${tokenId}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export default InvalidInterceptorTokenError;
