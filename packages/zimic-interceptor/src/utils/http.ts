import { HttpMethod } from '@zimic/http';
import { Server as HttpServer } from 'http';

class HttpServerTimeoutError extends Error {}

export class HttpServerStartTimeoutError extends HttpServerTimeoutError {
  constructor(reachedTimeout: number) {
    super(`HTTP server start timed out after ${reachedTimeout}ms.`);
    this.name = 'HttpServerStartTimeout';
  }
}

export class HttpServerStopTimeoutError extends HttpServerTimeoutError {
  constructor(reachedTimeout: number) {
    super(`HTTP server stop timed out after ${reachedTimeout}ms.`);
    this.name = 'HttpServerStopTimeout';
  }
}

export const DEFAULT_HTTP_SERVER_LIFECYCLE_TIMEOUT = 60 * 1000;

export async function startHttpServer(
  server: HttpServer,
  options: {
    hostname?: string;
    port?: number;
    timeout?: number;
  } = {},
) {
  const { hostname, port, timeout: timeoutDuration = DEFAULT_HTTP_SERVER_LIFECYCLE_TIMEOUT } = options;

  await new Promise<void>((resolve, reject) => {
    function handleStartError(error: unknown) {
      server.off('listening', handleStartSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    const startTimeout = setTimeout(() => {
      const timeoutError = new HttpServerStartTimeoutError(timeoutDuration);
      handleStartError(timeoutError);
    }, timeoutDuration);

    function handleStartSuccess() {
      server.off('error', handleStartError);
      clearTimeout(startTimeout);
      resolve();
    }

    server.once('error', handleStartError);
    server.listen(port, hostname, handleStartSuccess);
  });
}

export async function stopHttpServer(server: HttpServer, options: { timeout?: number } = {}) {
  const { timeout: timeoutDuration = DEFAULT_HTTP_SERVER_LIFECYCLE_TIMEOUT } = options;

  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const stopTimeout = setTimeout(() => {
      const timeoutError = new HttpServerStopTimeoutError(timeoutDuration);
      reject(timeoutError);
    }, timeoutDuration);

    server.close((error) => {
      clearTimeout(stopTimeout);

      /* istanbul ignore if -- @preserve
       * This is expected not to happen since the servers are not stopped unless they are running. */
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    server.closeAllConnections();
  });
}

export function getHttpServerPort(server: HttpServer) {
  const address = server.address();

  /* istanbul ignore if -- @preserve
   * The address is expected to be an object because the server does not listen on a pipe or Unix domain socket.  */
  if (typeof address === 'string') {
    return undefined;
  } else {
    return address?.port;
  }
}

export const HTTP_METHODS_WITH_REQUEST_BODY = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

export function methodCanHaveRequestBody(method: HttpMethod) {
  return HTTP_METHODS_WITH_REQUEST_BODY.has(method);
}

export const HTTP_METHODS_WITH_RESPONSE_BODY = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

export function methodCanHaveResponseBody(method: HttpMethod) {
  return HTTP_METHODS_WITH_RESPONSE_BODY.has(method);
}
