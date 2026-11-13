import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorConnectionRequest } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.delay()` that computes the delay in milliseconds for each matched connection
 * attempt, before the handshake is answered.
 */
export type WebSocketConnectionHandlerDelayFactory<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = (request: WebSocketInterceptorConnectionRequest<Schema, Path>) => PossiblePromise<number>;
