import { ValidationError } from '@zimic/utils/validation';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when a Socket.IO protocol starts with a polling interceptor that cannot serve its interceptor.
 */
class InvalidSocketIOPollingInterceptorError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid Socket.IO polling interceptor: ${reason}`);
    this.name = 'InvalidSocketIOPollingInterceptorError';
  }
}

export default InvalidSocketIOPollingInterceptorError;
