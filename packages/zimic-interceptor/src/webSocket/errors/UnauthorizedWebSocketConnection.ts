import { CloseEvent } from 'isomorphic-ws';

class UnauthorizedWebSocketConnect extends Error {
  constructor(readonly event: CloseEvent) {
    super(`The connection to the web socket server was unauthorized: ${event.reason} (${event.code})`);
    this.name = 'UnauthorizedWebSocketConnect';
  }
}

export default UnauthorizedWebSocketConnect;
