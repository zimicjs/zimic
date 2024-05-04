class NotStartedWebSocketHandlerError extends Error {
  constructor() {
    super('The web socket handler is not running.');
    this.name = 'NotStartedWebSocketHandlerError';
  }
}

export default NotStartedWebSocketHandlerError;
