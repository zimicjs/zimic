import { HttpInterceptorWorkerPlatform } from '../types/options';

/**
 * Error thrown when an invalid worker platform is provided.
 */
class InvalidHttpInterceptorWorkerPlatform extends Error {
  constructor(platform: unknown) {
    const availablePlatforms = Object.values(HttpInterceptorWorkerPlatform);
    const formattedAvailablePlatforms = availablePlatforms.map((platform) => `'${platform}'`).join(', ');
    super(`Invalid worker platform: '${platform}'. The available options are: ${formattedAvailablePlatforms}.`);
  }
}

export default InvalidHttpInterceptorWorkerPlatform;
