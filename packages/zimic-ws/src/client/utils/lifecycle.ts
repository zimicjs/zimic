import { DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT, WebSocketOpenTimeoutError } from '@zimic/utils/ws';

export interface WebSocketClientOpenOptions {
  timeout?: number;
}

export async function openWebSocketClient(socket: WebSocket, options: WebSocketClientOpenOptions = {}) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyOpen = socket.readyState === socket.OPEN;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const openTimeout = setTimeout(() => {
      const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
      handleError(timeoutError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }, timeoutDuration);

    function removeListenersAndTimeout() {
      clearTimeout(openTimeout);

      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeListenersAndTimeout();
      reject(error);
    }

    function handleOpenSuccess() {
      removeListenersAndTimeout();
      resolve();
    }

    socket.addEventListener('open', handleOpenSuccess);
    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleError);
  });
}

export type WebSocketClientCloseOptions = WebSocketClientOpenOptions;
