class NotStartedWebSocketHandlerError extends Error {
  constructor() {
    super('Web socket handler is not running.');
    this.name = 'NotStartedWebSocketHandlerError';
  }
}

export default NotStartedWebSocketHandlerError;
