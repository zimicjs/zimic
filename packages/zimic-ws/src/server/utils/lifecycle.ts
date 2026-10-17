import { DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT, WebSocketOpenTimeoutError } from '@zimic/utils/ws';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

export interface WebSocketServerOpenOptions {
  timeout?: number;
}

export async function openWebSocketServer(
  httpServer: HttpServer | HttpsServer,
  webSocketServer: NodeWebSocketServer,
  options: WebSocketServerOpenOptions = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyOpen = httpServer.listening;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const openTimeout = setTimeout(() => {
      const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
      reject(timeoutError);
    }, timeoutDuration);

    function removeListenersAndTimeout() {
      clearTimeout(openTimeout);

      webSocketServer.off('listening', handleListening); // eslint-disable-line @typescript-eslint/no-use-before-define
      webSocketServer.off('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    /* istanbul ignore next -- @preserve
     * This is not expected since the server is not started unless it is not running. */
    function handleError(error: unknown) {
      removeListenersAndTimeout();
      reject(error);
    }

    function handleListening() {
      removeListenersAndTimeout();
      resolve();
    }

    webSocketServer.on('listening', handleListening);
    webSocketServer.on('error', handleError);
  });
}

export type WebSocketServerCloseOptions = WebSocketServerOpenOptions;
