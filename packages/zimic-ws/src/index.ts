export type { WebSocketSchema, WebSocketMessageData } from './types/schema';

export { WebSocketCloseTimeoutError } from './errors/WebSocketCloseTimeoutError';
export { WebSocketMessageAbortError } from './errors/WebSocketMessageAbortError';
export { WebSocketOpenTimeoutError } from './errors/WebSocketOpenTimeoutError';
export { WebSocketTimeoutError } from './errors/WebSocketTimeoutError';

export { WebSocketClient } from './client/WebSocketClient';
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
