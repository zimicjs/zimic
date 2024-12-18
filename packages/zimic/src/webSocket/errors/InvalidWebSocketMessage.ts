class InvalidWebSocketMessage extends Error {
  constructor(message: unknown) {
    super(`Web socket message is invalid and could not be parsed: ${message}`);
    this.name = 'InvalidWebSocketMessage';
  }
}

export default InvalidWebSocketMessage;
