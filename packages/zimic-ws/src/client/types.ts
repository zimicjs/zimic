import WebSocketClient from './WebSocketClient';

export type WebSocketReadyState =
  | typeof WebSocketClient.CONNECTING
  | typeof WebSocketClient.OPEN
  | typeof WebSocketClient.CLOSING
  | typeof WebSocketClient.CLOSED;
