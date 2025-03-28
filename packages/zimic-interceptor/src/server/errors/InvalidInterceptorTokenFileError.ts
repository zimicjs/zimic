import InterceptorAuthError from './InterceptorAuthError';

class InvalidInterceptorTokenFileError extends InterceptorAuthError {
  constructor(tokenFilePath: string) {
    super(`Invalid interceptor token file: ${tokenFilePath}`);
    this.name = 'InvalidInterceptorTokenFileError';
  }
}

export default InvalidInterceptorTokenFileError;
