/**
 * Error thrown when an interceptor token file is invalid.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication Interceptor server authentication}
 */
class InvalidInterceptorTokenFileError extends Error {
  constructor(tokenFilePath: string, validationErrorMessage: string) {
    super(`Invalid interceptor token file ${tokenFilePath}: ${validationErrorMessage}`);
    this.name = 'InvalidInterceptorTokenFileError';
  }
}

export default InvalidInterceptorTokenFileError;
