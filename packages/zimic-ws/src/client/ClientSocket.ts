import NodeWebSocket from 'ws';

// WebSocket is available natively in browsers and Node.js >=22.
const isNativeWebSocketAvailable = typeof globalThis.WebSocket === 'undefined';

export const ClientSocket = (
  isNativeWebSocketAvailable ? NodeWebSocket : globalThis.WebSocket
) as typeof globalThis.WebSocket;

export type ClientSocket = InstanceType<typeof ClientSocket>;
