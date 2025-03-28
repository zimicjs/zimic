import InterceptorAuthError from './InterceptorAuthError';

class InvalidInterceptorTokenError extends InterceptorAuthError {
  constructor(tokenId?: string) {
    super(`Invalid interceptor token${tokenId ? `: ${tokenId}` : ''}`);
    this.name = 'InvalidInterceptorTokenError';
  }
}

export default InvalidInterceptorTokenError;
