import ClientSocket, { type WebSocketServer as ServerSocket } from 'isomorphic-ws';

import { WebSocketControlMessage } from '@/webSocket/constants';
import UnauthorizedWebSocketConnectionError from '@/webSocket/errors/UnauthorizedWebSocketConnectionError';

class WebSocketTimeoutError extends Error {}

export class WebSocketOpenTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket open timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketOpenTimeoutError';
  }
}

export class WebSocketMessageTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket message timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketMessageTimeoutError';
  }
}

export class WebSocketMessageAbortError extends WebSocketTimeoutError {
  constructor() {
    super('Web socket message was aborted.');
    this.name = 'WebSocketMessageAbortError';
  }
}

export class WebSocketCloseTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket close timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketCloseTimeoutError';
  }
}

export const DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT = 60 * 1000;
export const DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT = 3 * 60 * 1000;

export async function waitForOpenClientSocket(
  socket: ClientSocket,
  options: {
    timeout?: number;
    waitForAuthentication?: boolean;
  } = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT, waitForAuthentication = false } = options;

  const isAlreadyOpen = socket.readyState === socket.OPEN;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function removeAllSocketListeners() {
      socket.removeEventListener('message', handleSocketMessage); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('error', handleOpenError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleClose); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleOpenError(error: unknown) {
      removeAllSocketListeners();
      reject(error);
    }

    function handleClose(event: ClientSocket.CloseEvent) {
      const isUnauthorized = event.code === 1008;

      /* istanbul ignore else -- @preserve
       * An unauthorized close event is the only one we expect to happen here. */
      if (isUnauthorized) {
        const unauthorizedError = new UnauthorizedWebSocketConnectionError(event);
        handleOpenError(unauthorizedError);
      } else {
        handleOpenError(event);
      }
    }

    const openTimeout = setTimeout(() => {
      const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
      handleOpenError(timeoutError);
    }, timeoutDuration);

    function handleOpenSuccess() {
      removeAllSocketListeners();
      clearTimeout(openTimeout);
      resolve();
    }

    function handleSocketMessage(message: ClientSocket.MessageEvent) {
      const hasValidAuth = message.data === ('socket:auth:valid' satisfies WebSocketControlMessage);

      /* istanbul ignore else -- @preserve
       * We currently only support the 'socket:auth:valid' message and it is the only possible control message here. */
      if (hasValidAuth) {
        handleOpenSuccess();
      }
    }

    if (waitForAuthentication) {
      socket.addEventListener('message', handleSocketMessage);
    } else {
      socket.addEventListener('open', handleOpenSuccess);
    }

    socket.addEventListener('error', handleOpenError);
    socket.addEventListener('close', handleClose);
  });
}

export async function closeClientSocket(socket: ClientSocket, options: { timeout?: number } = {}) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

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

    const closeTimeout = setTimeout(() => {
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

    socket.close();
  });
}

export async function closeServerSocket(socket: InstanceType<typeof ServerSocket>, options: { timeout?: number } = {}) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  await new Promise<void>((resolve, reject) => {
    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      reject(timeoutError);
    }, timeoutDuration);

    for (const client of socket.clients) {
      client.terminate();
    }

    socket.close((error) => {
      clearTimeout(closeTimeout);

      /* istanbul ignore if -- @preserve
       * This is not expected since the server is not stopped unless it is running. */
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
