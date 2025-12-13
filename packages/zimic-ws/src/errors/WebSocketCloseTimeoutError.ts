import { WebSocketTimeoutError } from './WebSocketTimeoutError';

export class WebSocketCloseTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket close timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketCloseTimeoutError';
  }
}
