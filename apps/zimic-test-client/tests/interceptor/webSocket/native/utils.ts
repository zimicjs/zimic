export function createNativeWebSocket(url: string, protocols?: string | string[]) {
  return new WebSocket(url, protocols);
}

export async function openNativeWebSocket(url: string, protocols?: string | string[]) {
  const socket = createNativeWebSocket(url, protocols);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return socket;
}
