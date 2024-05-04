import { Server as HttpServer } from 'http';
import { vi } from 'vitest';

import { waitForDelay } from '@/utils/time';

export function delayToHttpServerListen(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalListen = HttpServer.prototype.listen;

  const delayedListenSpy = vi.spyOn(HttpServer.prototype, 'listen').mockImplementationOnce(function (
    this: HttpServer,
    ...parameters
  ) {
    void waitForDelay(delayDuration).then(() => {
      originalListen.apply(this, parameters);
    });
    return this;
  });

  return delayedListenSpy;
}
export function delayToHttpServerClose(delayDuration: number) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalClose = HttpServer.prototype.close;

  const delayedCloseSpy = vi.spyOn(HttpServer.prototype, 'close').mockImplementationOnce(function (
    this: HttpServer,
    ...parameters
  ) {
    void waitForDelay(delayDuration).then(() => {
      originalClose.apply(this, parameters);
    });
    return this;
  });

  return delayedCloseSpy;
}
