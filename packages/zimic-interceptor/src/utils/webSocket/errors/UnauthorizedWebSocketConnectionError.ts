import { CloseEvent } from 'isomorphic-ws';

/** Error thrown when the connection to the interceptor web socket server is unauthorized. */
class UnauthorizedWebSocketConnectionError extends Error {
  constructor(readonly event: CloseEvent) {
    super(`${event.reason} (code ${event.code})`);
    this.name = 'UnauthorizedWebSocketConnectionError';
  }
}

export default UnauthorizedWebSocketConnectionError;
