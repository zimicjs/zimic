import { Server as HttpServer } from 'http';

export async function startHttpServer(
  server: HttpServer,
  options: {
    hostname?: string;
    port?: number;
  } = {},
) {
  await new Promise<void>((resolve, reject) => {
    function handleStartError(error: unknown) {
      server.off('listening', handleStartSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    function handleStartSuccess() {
      server.off('error', handleStartError);
      resolve();
    }

    server.once('error', handleStartError);
    server.listen(options.port, options.hostname, handleStartSuccess);
  });
}

export async function stopHttpServer(server: HttpServer) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
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

  /* istanbul ignore else -- @preserve
   * The address is expected to be an object because the server does not listen on a pipe or Unix domain socket.  */
  if (typeof address !== 'string') {
    return address?.port;
  } else {
    return undefined;
  }
}
