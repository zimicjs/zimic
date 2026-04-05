export type { WebSocketSchema, WebSocketMessageData } from './types/schema';

export { WebSocketCloseTimeoutError } from './errors/WebSocketCloseTimeoutError';
export { WebSocketOpenTimeoutError } from './errors/WebSocketOpenTimeoutError';
export { WebSocketTimeoutError } from './errors/WebSocketTimeoutError';

export { WebSocketClient } from './client/WebSocketClient';
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
