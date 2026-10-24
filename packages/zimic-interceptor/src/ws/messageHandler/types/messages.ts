import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerdelay `handler.delay()` API reference}
 */
export type WebSocketMessageHandlerDelayFactory<Schema extends WebSocketSchema> = (
  message: Schema,
) => PossiblePromise<number>;
