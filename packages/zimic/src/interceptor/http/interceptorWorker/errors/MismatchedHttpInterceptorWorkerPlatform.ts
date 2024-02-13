import { HttpInterceptorWorkerPlatform } from '../types/options';

/**
 * Error thrown when a mismatched worker platform is provided. This happens when using `browser` outside a browser or
 * `node` outside Node.js.
 */
class MismatchedHttpInterceptorWorkerPlatform extends Error {
  constructor(platform: HttpInterceptorWorkerPlatform) {
    super(`'${platform}' was provided, but you are not currently in this platform.`);
    this.name = 'MismatchedHttpInterceptorWorkerPlatform';
  }
}

export default MismatchedHttpInterceptorWorkerPlatform;
