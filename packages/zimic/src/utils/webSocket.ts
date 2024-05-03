import ClientSocket from 'isomorphic-ws';

const { WebSocketServer: ServerSocket } = ClientSocket;

export async function waitForOpenClientSocket(socket: ClientSocket) {
  await new Promise<void>((resolve, reject) => {
    /* istanbul ignore next -- @preserve
     * This is not expected since the socket does not normally throw opening errors. */
    function handleOpenError(error: unknown) {
      socket.removeEventListener('open', handleOpenSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    function handleOpenSuccess() {
      socket.removeEventListener('error', handleOpenError);
      resolve();
    }

    socket.addEventListener('error', handleOpenError);
    socket.addEventListener('open', handleOpenSuccess);
  });
}

export async function closeClientSocket(socket: ClientSocket) {
  await new Promise<void>((resolve, reject) => {
    /* istanbul ignore next -- @preserve
     * This is not expected since the socket does not normally throw closing errors. */
    function handleCloseError(error: unknown) {
      socket.removeEventListener('close', handleCloseSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    function handleCloseSuccess() {
      socket.removeEventListener('error', handleCloseError);
      resolve();
    }

    socket.addEventListener('error', handleCloseError);
    socket.addEventListener('close', handleCloseSuccess);
    socket.close();
  });
}

export async function closeServerSocket(socket: InstanceType<typeof ServerSocket>) {
  await new Promise<void>((resolve, reject) => {
    /* istanbul ignore next -- @preserve
     * This is not expected since the server is not stopped unless it is running. */
    function handleServerError(error: unknown) {
      socket.off('close', handleServerClose); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject(error);
    }

    function handleServerClose() {
      socket.off('error', handleServerError);
      resolve();
    }

    socket.once('error', handleServerError);
    socket.once('close', handleServerClose);
    socket.close();
  });
}
