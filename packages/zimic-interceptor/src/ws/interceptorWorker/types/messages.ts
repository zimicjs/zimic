import { WebSocketSchema } from '@zimic/ws';

export interface SerializedWebSocketBinaryMessageData {
  type: 'binary';
  data: string;
}

export interface SerializedWebSocketJSONMessageData<Schema extends WebSocketSchema = WebSocketSchema> {
  type: 'json';
  data: Schema;
}

export interface SerializedWebSocketTextMessageData {
  type: 'text';
  data: string;
}

export type SerializedWebSocketMessageData<Schema extends WebSocketSchema = WebSocketSchema> =
  | SerializedWebSocketBinaryMessageData
  | SerializedWebSocketJSONMessageData<Schema>
  | SerializedWebSocketTextMessageData;
