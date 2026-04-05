import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

import { DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } from '@/client/utils/lifecycle';
import { WebSocketCloseTimeoutError } from '@/errors/WebSocketCloseTimeoutError';
import { WebSocketOpenTimeoutError } from '@/errors/WebSocketOpenTimeoutError';

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

    webSocketServer.once('listening', () => {
      clearTimeout(openTimeout);
      resolve();
    });

    webSocketServer.once(
      'error',
      /* istanbul ignore next -- @preserve
       * This is not expected since the server is not started unless it is not running. */
      (error) => {
        clearTimeout(openTimeout);
        reject(error);
      },
    );
  });
}

export type WebSocketServerCloseOptions = WebSocketServerOpenOptions;

export async function closeWebSocketServer(
  webSocketServer: NodeWebSocketServer,
  options: WebSocketServerCloseOptions = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  await new Promise<void>((resolve, reject) => {
    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      reject(timeoutError);
    }, timeoutDuration);

    for (const client of webSocketServer.clients) {
      client.close();
    }

    webSocketServer.close((error) => {
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
