export async function openNativeWebSocket(url: string, protocols?: string | string[]) {
  const socket = new WebSocket(url, protocols);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return socket;
}
