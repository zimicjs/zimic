/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#namespaces Socket.IO namespaces}
 */
class SharedSocketIOProtocolError extends Error {
  constructor() {
    super('A Socket.IO protocol can be used by only one running interceptor. Create one for each of them.');
    this.name = 'SharedSocketIOProtocolError';
  }
}

export default SharedSocketIOProtocolError;
