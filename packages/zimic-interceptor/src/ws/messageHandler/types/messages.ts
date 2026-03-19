import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

export type WebSocketMessageHandlerDelayFactory<Schema extends WebSocketSchema> = (
  message: Schema,
) => PossiblePromise<number>;
