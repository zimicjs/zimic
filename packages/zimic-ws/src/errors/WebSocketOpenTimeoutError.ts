import { WebSocketTimeoutError } from './WebSocketTimeoutError';

export class WebSocketOpenTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket open timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketOpenTimeout';
  }
}
