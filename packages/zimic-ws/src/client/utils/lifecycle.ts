import { WebSocketCloseTimeoutError } from '@/errors/WebSocketCloseTimeoutError';
import { WebSocketOpenTimeoutError } from '@/errors/WebSocketOpenTimeoutError';

import { ClientSocket } from '../ClientSocket';

export async function openClientSocket(socket: ClientSocket, options: { timeout?: number } = {}) {
  const { timeout: timeoutDuration } = options;

  const isAlreadyOpen = socket.readyState === socket.OPEN;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function removeAllSocketListeners() {
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleOpenError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleClose); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleOpenError(error: unknown) {
      removeAllSocketListeners();
      reject(error);
    }

    function handleClose(event: CloseEvent) {
      handleOpenError(event);
    }

    const openTimeout =
      timeoutDuration === undefined
        ? undefined
        : setTimeout(() => {
            const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
            handleOpenError(timeoutError);
          }, timeoutDuration);

    function handleOpenSuccess() {
      removeAllSocketListeners();
      clearTimeout(openTimeout);
      resolve();
    }

    socket.addEventListener('open', handleOpenSuccess);
    socket.addEventListener('error', handleOpenError);
    socket.addEventListener('close', handleOpenError);
  });
}

export async function closeClientSocket(
  socket: ClientSocket,
  options: { code?: number; reason?: string; timeout?: number } = {},
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
