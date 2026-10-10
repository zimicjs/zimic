/** A schema-aware WebSocket server backed by an HTTP or HTTPS server. See the [WebSocket API](/docs/ws). */
export { WebSocketServer } from './WebSocketServer';
/** Options for creating a WebSocket server. */
export type { WebSocketServerOptions } from './WebSocketServer';
/** Timeout options for opening and closing WebSocket servers. */
export type { WebSocketServerOpenOptions, WebSocketServerCloseOptions } from './utils/lifecycle';
