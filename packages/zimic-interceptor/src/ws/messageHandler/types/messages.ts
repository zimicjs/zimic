import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

export type WebSocketMessageHandlerDelayFactory<Schema extends WebSocketSchema> = (
  message: WebSocketMessageData<Schema>,
) => PossiblePromise<number>;
