import { WebSocketTimeoutError } from './WebSocketTimeoutError';

export class WebSocketMessageAbortError extends WebSocketTimeoutError {
  constructor() {
    super('Web socket message was aborted.');
    this.name = 'WebSocketMessageAbortError';
  }
}
