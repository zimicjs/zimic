import { CloseEvent } from 'isomorphic-ws';

/** Error thrown when the interceptor web socket server fails internally while accepting a connection. */
class InternalWebSocketServerError extends Error {
  constructor(readonly event: CloseEvent) {
    super(`${event.reason} (code ${event.code})`);
    this.name = 'InternalWebSocketServerError';
  }
}

export default InternalWebSocketServerError;
