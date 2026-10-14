import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * A function declared with `handler.delay()` that computes the delay in milliseconds for each matched message.
 */
export type WebSocketMessageHandlerDelayFactory<Schema extends WebSocketSchema> = (
  message: Schema,
) => PossiblePromise<number>;
