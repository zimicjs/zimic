/**
 * Error thrown when an interceptor token is invalid.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenError extends Error {
  constructor(tokenId: string) {
    super(`Invalid interceptor token: ${tokenId}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export default InvalidInterceptorTokenError;
