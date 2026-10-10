/** Types for WebSocket message data and schema inference. */
export type { WebSocketSchema, WebSocketMessageData } from './types/schema';

/** Thrown when a WebSocket client does not close before its timeout. */
export { WebSocketCloseTimeoutError } from './errors/WebSocketCloseTimeoutError';
/** Thrown when a WebSocket client does not open before its timeout. */
export { WebSocketOpenTimeoutError } from './errors/WebSocketOpenTimeoutError';
/** Base error for WebSocket lifecycle timeouts. */
export { WebSocketTimeoutError } from './errors/WebSocketTimeoutError';

/** A schema-aware wrapper around a browser WebSocket client. See the [WebSocket API](/docs/ws). */
export { WebSocketClient } from './client/WebSocketClient';
/** Timeout options for opening and closing WebSocket clients. */
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
