import InterceptorAuthError from './InterceptorAuthError';

/**
 * Error thrown when an interceptor token file is invalid.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenFileError extends InterceptorAuthError {
  constructor(tokenFilePath: string) {
    super(`Invalid interceptor token file: ${tokenFilePath}`);
    this.name = 'InvalidInterceptorTokenFileError';
  }
}

export default InvalidInterceptorTokenFileError;
