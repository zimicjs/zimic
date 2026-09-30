export interface SerializedWebSocketBinaryMessageData {
  type: 'binary';
  data: string;
}

export interface SerializedWebSocketTextMessageData {
  type: 'text';
  data: string;
}

export type SerializedWebSocketMessageData = SerializedWebSocketBinaryMessageData | SerializedWebSocketTextMessageData;
