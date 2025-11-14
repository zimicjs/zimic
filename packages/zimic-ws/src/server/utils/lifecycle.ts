import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';

import { WebSocketCloseTimeoutError } from '@/errors/WebSocketCloseTimeoutError';
import { WebSocketOpenTimeoutError } from '@/errors/WebSocketOpenTimeoutError';

import { ServerSocket } from '../ServerSocket';

export async function openServerSocket(
  server: HttpServer | HttpsServer,
  socket: ServerSocket,
  options: { timeout?: number } = {},
) {
  const { timeout: timeoutDuration } = options;

  const isAlreadyOpen = server.listening;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const openTimeout =
      timeoutDuration === undefined
        ? undefined
        : setTimeout(() => {
            const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
            reject(timeoutError);
          }, timeoutDuration);

    socket.once('listening', () => {
      clearTimeout(openTimeout);
      resolve();
    });

    socket.once('error', (error) => {
      clearTimeout(openTimeout);
      reject(error);
    });
  });
}

export async function closeServerSocket(
  server: HttpServer | HttpsServer,
  socket: ServerSocket,
  options: { timeout?: number } = {},
) {
  const { timeout: timeoutDuration } = options;

  const isAlreadyClosed = !server.listening;

  if (isAlreadyClosed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const closeTimeout =
      timeoutDuration === undefined
        ? undefined
        : setTimeout(() => {
            const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
            reject(timeoutError);
          }, timeoutDuration);

    for (const client of socket.clients) {
      client.close();
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
