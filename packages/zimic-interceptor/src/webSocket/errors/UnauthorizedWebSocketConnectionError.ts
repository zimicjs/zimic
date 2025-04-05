import { CloseEvent } from 'isomorphic-ws';

/** Error thrown when the connection to the interceptor web socket server is unauthorized. */
class UnauthorizedWebSocketConnectionError extends Error {
  constructor(readonly event: CloseEvent) {
    super(`The connection to the web socket server was unauthorized: ${event.reason} (${event.code})`);
    this.name = 'UnauthorizedWebSocketConnectionError';
  }
}

export default UnauthorizedWebSocketConnectionError;
