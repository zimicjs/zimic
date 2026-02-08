export type {
  WebSocketSchema,
  WebSocketEvent,
  WebSocketEventType,
  WebSocketEventMap,
  WebSocketMessageData,
} from './types/schema';

export { WebSocketCloseTimeoutError } from './errors/WebSocketCloseTimeoutError';
export { WebSocketMessageAbortError } from './errors/WebSocketMessageAbortError';
export { WebSocketOpenTimeoutError } from './errors/WebSocketOpenTimeoutError';
export { WebSocketTimeoutError } from './errors/WebSocketTimeoutError';

export { default as WebSocketClient } from './client/WebSocketClient';
export type { WebSocketReadyState } from './client/types';
