import InterceptorAuthError from './InterceptorAuthError';

class InvalidInterceptorTokenError extends InterceptorAuthError {
  constructor(tokenId: string | undefined) {
    super(`Invalid interceptor token:${tokenId === undefined ? '' : ` ${tokenId}`}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export default InvalidInterceptorTokenError;
