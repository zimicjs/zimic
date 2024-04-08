import { describe, expect, it, vi } from 'vitest';

import { HttpInterceptorWorker as PublicHttpInterceptorWorker } from '@/interceptor/http/interceptorWorker/types/public';

import UnregisteredServiceWorkerError from '../errors/UnregisteredServiceWorkerError';
import { createHttpInterceptorWorker } from '../factory';
import HttpInterceptorWorker from '../HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform } from '../types/options';
import { BrowserHttpWorker } from '../types/requests';

describe('HttpInterceptorWorker (browser, no worker)', () => {
  const platform = 'browser' satisfies HttpInterceptorWorkerPlatform;

  it('should throw an error after failing to start without a registered service worker', async () => {
    const interceptorWorker = createHttpInterceptorWorker({
      type: 'local',
    }) satisfies PublicHttpInterceptorWorker as HttpInterceptorWorker;

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(new UnregisteredServiceWorkerError());

    expect(interceptorWorker.platform()).toBe(platform);
  });

  it('should throw an error after failing to start due to a unknown error', async () => {
    const interceptorWorker = createHttpInterceptorWorker({
      type: 'local',
    }) satisfies PublicHttpInterceptorWorker as HttpInterceptorWorker;

    const internalBrowserWorker = (await interceptorWorker.internalWorkerOrLoad()) as BrowserHttpWorker;
    const unknownError = new Error('Unknown error');
    vi.spyOn(internalBrowserWorker, 'start').mockRejectedValueOnce(unknownError);

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(unknownError);

    expect(interceptorWorker.platform()).toBe(platform);
  });
});
