export type {
  WebSocketSchema,
  WebSocketSchemaPath,
  WebSocketSchemaMessage,
  LiteralWebSocketSchemaPathFromNonLiteral,
  InferPathParams,
  WebSocketPathSchema,
  WebSocketConnectionSchema,
  WebSocketConnectionSearchParamsSchema,
  WebSocketConnectionProtocolSchema,
  WebSocketMessageSchema,
  WebSocketMessageData,
} from './types/schema';
export type { JSONStringified } from './types/json';

export { WebSocketCloseTimeoutError, WebSocketOpenTimeoutError, WebSocketTimeoutError } from '@zimic/utils/ws';

export { WebSocketClient } from './client/WebSocketClient';
export type { WebSocketClientOpenOptions, WebSocketClientCloseOptions } from './client/utils/lifecycle';
