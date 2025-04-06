/**
 * Error thrown when an interceptor token is invalid.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenError extends Error {
  constructor(tokenId: string | undefined) {
    super(`Invalid interceptor token:${tokenId === undefined ? '' : ` ${tokenId}`}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export default InvalidInterceptorTokenError;
