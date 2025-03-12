class NotRunningWebSocketHandlerError extends Error {
  constructor() {
    super('Web socket handler is not running.');
    this.name = 'NotRunningWebSocketHandlerError';
  }
}

export default NotRunningWebSocketHandlerError;
