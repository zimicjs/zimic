/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * An error thrown when a Socket.IO protocol starts in an interceptor while another running interceptor uses it.
 */
class SharedSocketIOProtocolError extends Error {
  constructor() {
    super('A Socket.IO protocol can be used by only one running interceptor. Create one for each of them.');
    this.name = 'SharedSocketIOProtocolError';
  }
}

export default SharedSocketIOProtocolError;
