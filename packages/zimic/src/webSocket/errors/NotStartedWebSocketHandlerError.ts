class NotStartedWebSocketHandlerError extends Error {
  constructor() {
    super('[zimic] Web socket handler is not running.');
    this.name = 'NotStartedWebSocketHandlerError';
  }
}

export default NotStartedWebSocketHandlerError;
