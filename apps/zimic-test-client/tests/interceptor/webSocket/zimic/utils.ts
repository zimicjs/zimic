import { WebSocketClient } from '@zimic/ws';

export async function openZimicWebSocket(url: string, protocols?: string | string[]) {
  const socket = new WebSocketClient(url, protocols);
  await socket.open();
  return socket;
}
