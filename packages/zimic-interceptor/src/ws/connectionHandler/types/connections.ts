import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorConnectionRequest } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-connection-handler#handlerdelay `handler.delay()` API reference}
 */
export type WebSocketConnectionHandlerDelayFactory<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = (request: WebSocketInterceptorConnectionRequest<Schema, Path>) => PossiblePromise<number>;
