import ClientSocket, { type WebSocketServer as ServerSocket } from 'isomorphic-ws';

class WebSocketTimeoutError extends Error {}

export class WebSocketOpenTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket open timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketOpenTimeout [zimic]';
  }
}

export class WebSocketMessageTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket message timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketMessageTimeout [zimic]';
  }
}

export class WebSocketMessageAbortError extends WebSocketTimeoutError {
  constructor() {
    super('Web socket message was aborted.');
    this.name = 'WebSocketMessageAbortError [zimic]';
  }
}

export class WebSocketCloseTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket close timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketCloseTimeout [zimic]';
  }
}

export const DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT = 60 * 1000;
export const DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT = 3 * 60 * 1000;

export async function waitForOpenClientSocket(
  socket: ClientSocket,
  options: {
    timeout?: number;
  } = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyOpen = socket.readyState === socket.OPEN;

  if (isAlreadyOpen) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function handleOpenError(error: unknown) {
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    const openTimeout = setTimeout(() => {
      const timeoutError = new WebSocketOpenTimeoutError(timeoutDuration);
      handleOpenError(timeoutError);
    }, timeoutDuration);

    function handleOpenSuccess() {
      socket.removeEventListener('error', handleOpenError);
      clearTimeout(openTimeout);
      resolve();
    }

    socket.addEventListener('open', handleOpenSuccess);
    socket.addEventListener('error', handleOpenError);
  });
}

export async function closeClientSocket(socket: ClientSocket, options: { timeout?: number } = {}) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyClosed = socket.readyState === socket.CLOSED;
  if (isAlreadyClosed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    function handleCloseError(error: unknown) {
      socket.removeEventListener('close', handleCloseSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      handleCloseError(timeoutError);
    }, timeoutDuration);

    function handleCloseSuccess() {
      socket.removeEventListener('error', handleCloseError);
      clearTimeout(closeTimeout);
      resolve();
    }

    socket.addEventListener('error', handleCloseError);
    socket.addEventListener('close', handleCloseSuccess);
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
