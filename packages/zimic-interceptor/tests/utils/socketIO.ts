import { Manager, type ManagerOptions, type Socket } from 'socket.io-client';

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
    const { engine } = manager;

    if (engine.readyState !== 'closed') {
      const closePromise = new Promise<void>((resolve) => {
        engine.once('close', () => resolve());
      });

      engine.close();
      await closePromise;
    }
  }
}

export async function usingSocket(
  baseURL: string,
  options: Partial<ManagerOptions> & { nsp?: string },
  callback: (socket: Socket) => Promise<void>,
) {
  const { nsp = '/', ...managerOptions } = options;

  await usingSocketManager(baseURL, managerOptions, async (manager) => {
    const socket = manager.socket(nsp);

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
