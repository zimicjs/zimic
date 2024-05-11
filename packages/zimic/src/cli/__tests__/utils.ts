import { Server as HttpServer } from 'http';
import { vi } from 'vitest';

export function delayHttpServerListenIndefinitely() {
  const delayedListenSpy = vi.spyOn(HttpServer.prototype, 'listen').mockImplementationOnce(function (this: HttpServer) {
    return this;
  });

  return delayedListenSpy;
}
export function delayHttpServerCloseIndefinitely(options: { onCall: () => void }) {
  const delayedCloseSpy = vi.spyOn(HttpServer.prototype, 'close').mockImplementationOnce(function (this: HttpServer) {
    options.onCall();
    return this;
  });

  return delayedCloseSpy;
}
