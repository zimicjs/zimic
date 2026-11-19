import type { SocketIOProtocolOptions } from '../types/options';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when the Socket.IO protocols of the namespaces of one base URL pass different values to an option
 * they share.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#namespaces Socket.IO namespaces}
 */
class MismatchedSocketIOProtocolOptionsError extends Error {
  constructor(optionName: keyof Pick<SocketIOProtocolOptions, 'parser' | 'polling'>, baseURL: string) {
    super(`The Socket.IO protocols of the namespaces of ${baseURL} must use the same \`${optionName}\` option.`);
    this.name = 'MismatchedSocketIOProtocolOptionsError';
  }
}

export default MismatchedSocketIOProtocolOptionsError;
