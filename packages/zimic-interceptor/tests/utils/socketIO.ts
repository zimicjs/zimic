import { Manager, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

import { removeTrailingSlash } from '@/utils/urls';

export async function usingSocketManager(
  baseURL: string,
  options: Partial<ManagerOptions>,
  callback: (manager: Manager) => Promise<void>,
) {
  const { origin, pathname } = new URL(baseURL);

  const manager = new Manager(origin.replace(/^ws/, 'http'), {
    path: `${removeTrailingSlash(pathname)}/`,
    reconnection: false,
    ...options,
  });

  try {
    await callback(manager);
  } finally {
    if (manager.engine.readyState !== 'closed') {
      const closePromise = new Promise<void>((resolve) => {
        manager.engine.once('close', () => resolve());
      });

      manager.engine.close();
      await closePromise;
    }
  }
}

export async function usingSocket(
  baseURL: string,
  options: Partial<ManagerOptions> & Pick<SocketOptions, 'auth'> & { nsp?: string },
  callback: (socket: Socket) => Promise<void>,
) {
  const { nsp = '/', auth, ...managerOptions } = options;

  await usingSocketManager(baseURL, managerOptions, async (manager) => {
    const socket = manager.socket(nsp, { auth });

    try {
      await callback(socket);
    } finally {
      socket.disconnect();
    }
  });
}

export async function waitForSocketConnection(socket: Socket) {
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

export async function waitForSocketDisconnection(socket: Socket) {
  await new Promise<void>((resolve) => {
    socket.once('disconnect', () => resolve());
  });
}
