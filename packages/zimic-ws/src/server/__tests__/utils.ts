import { waitForDelay } from '@zimic/utils/time';
import { vi } from 'vitest';
import { WebSocketServer } from 'ws';

export function delayWebSocketServerClose(delayDuration: number) {
  const originalWebSocketServerClose = WebSocketServer.prototype.close;

  const promises = new Set<Promise<void>>();

  const delayedWebSocketServerClose = vi.spyOn(WebSocketServer.prototype, 'close').mockImplementationOnce(function (
    this: WebSocketServer,
    ...parameters
  ) {
    const promise = waitForDelay(delayDuration).then(() => {
      originalWebSocketServerClose.apply(this, parameters);
      promises.delete(promise);
    });
    promises.add(promise);

    return this;
  });

  return {
    restore() {
      delayedWebSocketServerClose.mockRestore();
    },
    toPromise() {
      return Promise.all(promises);
    },
  };
}
