import { WebSocketSchema } from '@zimic/ws';

export interface SerializedWebSocketBinaryMessageData {
  type: 'binary';
  data: string;
}

export type SerializedWebSocketMessageData<Schema extends WebSocketSchema = WebSocketSchema> =
  | Schema
  | string
  | SerializedWebSocketBinaryMessageData;
