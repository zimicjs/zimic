export const DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT = 60 * 1000;

export class WebSocketTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketTimeoutError';
  }
}

export class WebSocketOpenTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket open timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketOpenTimeoutError';
  }
}

export class WebSocketCloseTimeoutError extends WebSocketTimeoutError {
  constructor(reachedTimeout: number) {
    super(`Web socket close timed out after ${reachedTimeout}ms.`);
    this.name = 'WebSocketCloseTimeoutError';
  }
}

// Structural types so that both DOM and `ws` sockets are accepted without importing `ws`.
interface ClosableWebSocketClient {
  readonly readyState: number;
  readonly CLOSED: number;
  addEventListener: (type: 'error' | 'close', listener: (event: unknown) => void) => void;
  removeEventListener: (type: 'error' | 'close', listener: (event: unknown) => void) => void;
  close: (code?: number, reason?: string) => void;
}

interface ClosableWebSocketServer {
  readonly clients: Iterable<{ close: () => void; terminate: () => void }>;
  close: (callback: (error?: Error) => void) => void;
}

export async function closeWebSocketClient(
  socket: ClosableWebSocketClient,
  options: { timeout?: number; code?: number; reason?: string } = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options;

  const isAlreadyClosed = socket.readyState === socket.CLOSED;

  if (isAlreadyClosed) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      handleError(timeoutError); // eslint-disable-line @typescript-eslint/no-use-before-define
    }, timeoutDuration);

    function removeListenersAndTimeout() {
      clearTimeout(closeTimeout);

      socket.removeEventListener('error', handleError); // eslint-disable-line @typescript-eslint/no-use-before-define
      socket.removeEventListener('close', handleClose); // eslint-disable-line @typescript-eslint/no-use-before-define
    }

    function handleError(error: unknown) {
      removeListenersAndTimeout();
      reject(error);
    }

    function handleClose() {
      removeListenersAndTimeout();
      resolve();
    }

    socket.addEventListener('error', handleError);
    socket.addEventListener('close', handleClose);

    socket.close(options.code, options.reason);
  });
}

export async function closeWebSocketServer(
  server: ClosableWebSocketServer,
  options: { timeout?: number; terminateClients?: boolean } = {},
) {
  const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT, terminateClients = false } = options;

  await new Promise<void>((resolve, reject) => {
    const closeTimeout = setTimeout(() => {
      const timeoutError = new WebSocketCloseTimeoutError(timeoutDuration);
      reject(timeoutError);
    }, timeoutDuration);

    for (const client of server.clients) {
      if (terminateClients) {
        client.terminate();
      } else {
        client.close();
      }
    }

    server.close((error) => {
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
