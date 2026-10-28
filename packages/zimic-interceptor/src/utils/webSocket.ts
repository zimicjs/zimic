import {
  DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT,
  WebSocketOpenTimeoutError,
  WebSocketTimeoutError,
} from '@zimic/utils/ws';
import ClientSocket from 'isomorphic-ws';

import { WEB_SOCKET_CLOSE_CODES, WebSocketControlMessage } from '@/utils/webSocket/constants';
import InternalWebSocketServerError from '@/utils/webSocket/errors/InternalWebSocketServerError';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';

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
      if (event.code === WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION) {
        const unauthorizedError = new UnauthorizedWebSocketConnectionError(event);
        handleOpenError(unauthorizedError);
      } else if (event.code === WEB_SOCKET_CLOSE_CODES.INTERNAL_ERROR) {
        const internalError = new InternalWebSocketServerError(event);
        handleOpenError(internalError);
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
