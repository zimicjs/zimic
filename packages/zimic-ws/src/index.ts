export type {
  WebSocketSchema,
  WebSocketSchemaPath,
  WebSocketSchemaMessage,
  WebSocketPathSchema,
  WebSocketConnectionSchema,
  WebSocketMessageSchema,
  WebSocketMessageData,
} from './types/schema';
export type { JSONStringified } from './types/json';

export { WebSocketCloseTimeoutError, WebSocketOpenTimeoutError, WebSocketTimeoutError } from '@zimic/utils/ws';

export { WebSocketClient, type WebSocketClientDefaultPath } from './client/WebSocketClient';
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
