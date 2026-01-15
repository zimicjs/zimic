export class WebSocketTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketTimeoutError';
  }
}
