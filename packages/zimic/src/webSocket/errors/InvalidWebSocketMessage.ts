class InvalidWebSocketMessage extends Error {
  constructor(message: unknown) {
    super(`[zimic] Web socket message is invalid and could not be parsed: ${message}`);
    this.name = 'InvalidWebSocketMessage';
  }
}

export default InvalidWebSocketMessage;
