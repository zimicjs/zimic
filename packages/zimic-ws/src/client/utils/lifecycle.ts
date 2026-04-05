import { WebSocketCloseTimeoutError } from '@/errors/WebSocketCloseTimeoutError';
import { WebSocketOpenTimeoutError } from '@/errors/WebSocketOpenTimeoutError';

export const DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT = 60 * 1000;

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
    function removeListeners() {
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeListeners();
      reject(error);
    }

    const openTimeout = setTimeout(() => {
      const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
      handleError(timeoutError);
    }, timeoutDuration);

    function handleOpenSuccess() {
      removeListeners();
      clearTimeout(openTimeout);
      resolve();
    }

    socket.addEventListener('open', handleOpenSuccess);
    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleError);
  });
}

export type WebSocketClientCloseOptions = WebSocketClientOpenOptions;

export async function closeWebSocketClient(
  socket: WebSocket,
  options: WebSocketClientCloseOptions & { code?: number; reason?: string },
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyClosed = socket.readyState === socket.CLOSED;

  if (isAlreadyClosed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function removeListeners() {
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleClose); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeListeners();
      reject(error);
    }

    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      handleError(timeoutError);
    }, timeoutDuration);

    function handleClose() {
      removeListeners();
      clearTimeout(closeTimeout);
      resolve();
    }

    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleClose);

    socket.close(options.code, options.reason);
  });
}
