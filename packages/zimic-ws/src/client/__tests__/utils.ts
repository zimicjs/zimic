import { createPromiseWithResolvers } from '@zimic/utils/data';
import { vi } from 'vitest';

// Holds the next listener added to a socket until released.
export function delayWebSocketListenerTrigger() {
  const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;
  const released = createPromiseWithResolvers<void>();

  const delayedWebSocketAddEventListener = vi
    .spyOn(WebSocket.prototype, 'addEventListener')
    .mockImplementationOnce(function (this: WebSocket, type, listener, options) {
      void released.then(() => {
        originalWebSocketAddEventListener.call(this, type, listener, options);
      });
    });

  return {
    release() {
      released.resolve();
    },
    restore() {
      delayedWebSocketAddEventListener.mockRestore();
    },
  };
}

// Holds the close events of sockets until released, but only for listeners added while delaying. The sockets still
// close natively.
export function delayWebSocketClose() {
  const originalWebSocketAddEventListener = WebSocket.prototype.addEventListener;
  const released = createPromiseWithResolvers<void>();

  const delayedWebSocketAddEventListener = vi
    .spyOn(WebSocket.prototype, 'addEventListener')
    .mockImplementation(function (this: WebSocket, type, listener, options) {
      const delayedListener =
        type === 'close'
          ? (event: Event) => {
              void released.then(() => {
                (listener as EventListener)(event);
              });
            }
          : listener;

      originalWebSocketAddEventListener.call(this, type, delayedListener, options);
    });

  return {
    release() {
      released.resolve();
    },
    restore() {
      delayedWebSocketAddEventListener.mockRestore();
    },
  };
}
