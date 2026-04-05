import { waitForDelay } from '@zimic/utils/time';
import { vi } from 'vitest';

export function delayWebSocketListenerTrigger(delayDuration: number) {
  const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;

  const promises = new Set<Promise<void>>();

  const delayedWebSocketAddEventListener = vi
    .spyOn(WebSocket.prototype, 'addEventListener')
    .mockImplementationOnce(function (this: WebSocket, type, listener) {
      const promise = waitForDelay(delayDuration).then(() => {
        originalWebSocketAddEventListener.call(this, type, listener as () => void);
        promises.delete(promise);
      });
      promises.add(promise);

      return this;
    });

  return {
    restore() {
      delayedWebSocketAddEventListener.mockRestore();
    },
    asPromise() {
      return Promise.all(promises);
    },
  };
}

export function delayWebSocketClose(delayDuration: number) {
  const originalWebSocketClose = WebSocket.prototype.close;

  const promises = new Set<Promise<void>>();

  const delayedWebSocketClose = vi.spyOn(WebSocket.prototype, 'close').mockImplementationOnce(function (
    this: WebSocket,
    ...parameters
  ) {
    const promise = waitForDelay(delayDuration).then(() => {
      originalWebSocketClose.apply(this, parameters);
      promises.delete(promise);
    });
    promises.add(promise);

    return this;
  });

  return {
    restore() {
      delayedWebSocketClose.mockRestore();
    },
    toPromise() {
      return Promise.all(promises);
    },
  };
}
