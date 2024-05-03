import ClientSocket from 'isomorphic-ws';

const { WebSocketServer: ServerSocket } = ClientSocket;

export async function waitForOpenClientSocket(socket: ClientSocket) {
  const isOpen = socket.readyState === socket.OPEN;

  if (isOpen) {
    return;
  }

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
  const isAlreadyClosed = socket.readyState === socket.CLOSED;

  if (isAlreadyClosed) {
    return;
  }

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
    socket.close((error) => {
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
