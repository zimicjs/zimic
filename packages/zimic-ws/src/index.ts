export type { WebSocketSchema, WebSocketMessageData } from './types/schema';
export type { JSONStringified } from './types/json';

export { WebSocketCloseTimeoutError, WebSocketOpenTimeoutError, WebSocketTimeoutError } from '@zimic/utils/ws';

export { WebSocketClient } from './client/WebSocketClient';
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
