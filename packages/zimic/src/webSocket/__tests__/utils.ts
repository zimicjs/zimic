import ClientSocket from 'isomorphic-ws';
import { vi } from 'vitest';

import { waitForDelay } from '@/utils/time';

const { WebSocketServer: ServerSocket } = ClientSocket;

export function delayClientSocketOpen(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalClientSocketAddEventListener = ClientSocket.prototype.addEventListener;

  const delayedClientSocketAddEventListener = vi
    .spyOn(ClientSocket.prototype, 'addEventListener')
    .mockImplementationOnce(function (this: void, type, listener) {
      void waitForDelay(delayDuration).then(() => {
        originalClientSocketAddEventListener.call(this, type, listener);
      });

      return this;
    });

  return delayedClientSocketAddEventListener;
}

export function delayServerSocketConnection() {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalServerSocketOn = ServerSocket.prototype.on;

  const delayedServerSocketOnSpy = vi.spyOn(ServerSocket.prototype, 'on').mockImplementation(function (
    this: InstanceType<typeof ServerSocket>,
    type,
    listener,
  ) {
    originalServerSocketOn.call(this, type, (...parameters) => {
      if (type === 'connection') {
        const socket = parameters[0] as ClientSocket;
        vi.spyOn(socket, 'readyState', 'get').mockReturnValueOnce(ClientSocket.CONNECTING);
      }

      listener.apply(this, parameters);
    });

    return this;
  });

  return delayedServerSocketOnSpy;
}

export function delayClientSocketSend(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalClientSocketSend = ClientSocket.prototype.send;

  const delayedClientSocketSend = vi.spyOn(ClientSocket.prototype, 'send').mockImplementationOnce(function (
    this: void,
    ...parameters
  ) {
    void waitForDelay(delayDuration).then(() => {
      originalClientSocketSend.apply(this, parameters);
    });
  });

  return delayedClientSocketSend;
}

export function delayClientSocketClose(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalClientSocketClose = ClientSocket.prototype.close;

  const delayedClientSocketClose = vi.spyOn(ClientSocket.prototype, 'close').mockImplementationOnce(function (
    this: void,
    ...parameters
  ) {
    void waitForDelay(delayDuration).then(() => {
      originalClientSocketClose.apply(this, parameters);
    });
  });

  return delayedClientSocketClose;
}

export function delayServerSocketClose(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalServerSocketClose = ServerSocket.prototype.close;

  const delayedServerSocketClose = vi.spyOn(ServerSocket.prototype, 'close').mockImplementationOnce(function (
    this: void,
    ...parameters
  ) {
    void waitForDelay(delayDuration).then(() => {
      originalServerSocketClose.apply(this, parameters);
    });
  });

  return delayedServerSocketClose;
}
