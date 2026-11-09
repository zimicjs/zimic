import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

export function createZimicWebSocket(url: string, protocols?: string | string[]): WebSocketClient<WebSocketSchema> {
  const socket = new WebSocketClient(url, protocols);

  // `open()` rejects if the connection fails, and tests observe that outcome through the socket events instead.
  // Listeners added synchronously after this call still reach the underlying socket, because `open()` creates it only
  // after awaiting the close of any previous one.
  socket.open().catch(() => undefined);

  return socket;
}

export async function openZimicWebSocket(
  url: string,
  protocols?: string | string[],
): Promise<WebSocketClient<WebSocketSchema>> {
  const socket = new WebSocketClient(url, protocols);
  await socket.open();
  return socket;
}
