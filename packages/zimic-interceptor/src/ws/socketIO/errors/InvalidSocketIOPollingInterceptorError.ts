import { ValidationError } from '@zimic/utils/validation';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#polling Socket.IO polling}
 */
class InvalidSocketIOPollingInterceptorError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid Socket.IO polling interceptor: ${reason}`);
    this.name = 'InvalidSocketIOPollingInterceptorError';
  }
}

export default InvalidSocketIOPollingInterceptorError;
