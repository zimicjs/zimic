import { waitForClientTestWebSocketOpen } from '../shared/client';

export function createNativeWebSocket(url: string, protocols?: string | string[]) {
  return new WebSocket(url, protocols);
}

export async function openNativeWebSocket(url: string, protocols?: string | string[]) {
  const socket = createNativeWebSocket(url, protocols);
  await waitForClientTestWebSocketOpen(socket);
  return socket;
}
