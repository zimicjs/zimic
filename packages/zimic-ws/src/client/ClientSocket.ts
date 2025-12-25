import NodeWebSocket from 'ws';

// WebSocket is available natively in browsers and Node.js >=22.
const isNativeWebSocketAvailable = typeof WebSocket !== 'undefined';

export const ClientSocket = (isNativeWebSocketAvailable ? WebSocket : NodeWebSocket) as typeof WebSocket;
export type ClientSocket = InstanceType<typeof ClientSocket>;
