import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { ReceivedWebSocketMessageData } from '@/ws/interceptor/types/messages';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.delay()` that computes the delay in milliseconds for each matched message. Binary
 * messages arrive as `ArrayBuffer`.
 */
export type WebSocketMessageHandlerDelayFactory<Schema extends WebSocketSchema> = (
  message: ReceivedWebSocketMessageData<Schema>,
) => PossiblePromise<number>;
