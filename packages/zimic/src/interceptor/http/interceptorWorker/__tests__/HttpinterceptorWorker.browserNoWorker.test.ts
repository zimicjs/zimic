import { describe, expect, it, vi } from 'vitest';

import { HttpInterceptorPlatform } from '../../interceptor/types/options';
import UnregisteredServiceWorkerError from '../errors/UnregisteredServiceWorkerError';
import { createHttpInterceptorWorker } from '../factory';
import { BrowserHttpWorker } from '../types/requests';

describe('HttpInterceptorWorker (browser, no worker)', () => {
  const platform = 'browser' satisfies HttpInterceptorPlatform;

  it('should throw an error after failing to start without a registered service worker', async () => {
    const interceptorWorker = createHttpInterceptorWorker({
      type: 'local',
    });

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(new UnregisteredServiceWorkerError());

    expect(interceptorWorker.platform()).toBe(platform);
  });

  it('should throw an error after failing to start due to a unknown error', async () => {
    const interceptorWorker = createHttpInterceptorWorker({
      type: 'local',
    });

    const internalBrowserWorker = (await interceptorWorker.internalWorkerOrLoad()) as BrowserHttpWorker;
    const unknownError = new Error('Unknown error');
    vi.spyOn(internalBrowserWorker, 'start').mockRejectedValueOnce(unknownError);

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(unknownError);

    expect(interceptorWorker.platform()).toBe(platform);
  });
});
