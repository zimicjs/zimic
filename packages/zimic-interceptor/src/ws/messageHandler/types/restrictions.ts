import { DeepPartial, PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

export type WebSocketMessageHandlerStaticRestriction<Schema extends WebSocketSchema> = DeepPartial<
  WebSocketMessageData<Schema>
>;

/** @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwith `handler.with()` API reference} */
export type WebSocketMessageHandlerComputedRestriction<Schema extends WebSocketSchema> = (
  message: WebSocketMessageData<Schema>,
) => PossiblePromise<boolean>;

export type WebSocketMessageHandlerRestriction<Schema extends WebSocketSchema> =
  | WebSocketMessageHandlerStaticRestriction<Schema>
  | WebSocketMessageHandlerComputedRestriction<Schema>;
