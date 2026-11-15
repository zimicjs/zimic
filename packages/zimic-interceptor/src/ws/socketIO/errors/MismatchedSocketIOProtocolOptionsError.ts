import type { SocketIOProtocolOptions } from '../types';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when the Socket.IO protocols of the namespaces of one base URL pass different values to an option
 * they share.
 */
class MismatchedSocketIOProtocolOptionsError extends Error {
  constructor(optionName: keyof SocketIOProtocolOptions, baseURL: string) {
    super(`The Socket.IO protocols of the namespaces of ${baseURL} must use the same \`${optionName}\` option.`);
    this.name = 'MismatchedSocketIOProtocolOptionsError';
  }
}

export default MismatchedSocketIOProtocolOptionsError;
