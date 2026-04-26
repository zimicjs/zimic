class ClosedWebSocketServerError extends Error {
  constructor() {
    super('The WebSocket server is closed. Did you forget to open it?');
    this.name = 'ClosedWebSocketServerError';
  }
}

export default ClosedWebSocketServerError;
