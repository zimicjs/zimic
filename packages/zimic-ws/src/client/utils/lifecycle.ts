import { WebSocketCloseTimeoutError } from '@/errors/WebSocketCloseTimeoutError';
import { WebSocketOpenTimeoutError } from '@/errors/WebSocketOpenTimeoutError';

export interface WebSocketClientOpenOptions {
  timeout?: number;
}

export async function openWebSocketClient(socket: WebSocket, options: WebSocketClientOpenOptions = {}) {
  const { timeout: timeoutDuration } = options;

  const isAlreadyOpen = socket.readyState === socket.OPEN;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function removeAllSocketListeners() {
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeAllSocketListeners();
      reject(error);
    }

    const openTimeout =
      timeoutDuration === undefined
        ? undefined
        : setTimeout(() => {
            const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
            handleError(timeoutError);
          }, timeoutDuration);

    function handleOpenSuccess() {
      removeAllSocketListeners();
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
  const { timeout: timeoutDuration } = options;

  const isAlreadyClosed = socket.readyState === socket.CLOSED;

  if (isAlreadyClosed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function removeAllSocketListeners() {
      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleClose); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeAllSocketListeners();
      reject(error);
    }

    const closeTimeout =
      timeoutDuration === undefined
        ? undefined
        : setTimeout(() => {
            const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
            handleError(timeoutError);
          }, timeoutDuration);

    function handleClose() {
      removeAllSocketListeners();
      clearTimeout(closeTimeout);
      resolve();
    }

    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleClose);

    socket.close(options.code, options.reason);
  });
}
