import { describe, expect, it, vi } from 'vitest';

import BrowserHttpInterceptorWorker from '../BrowserHttpInterceptorWorker';
import UnregisteredServiceWorkerError from '../errors/UnregisteredServiceWorkerError';

describe('BrowserHttpInterceptorWorker (no worker)', () => {
  it('should throw an error after failing to start without a registered service worker', async () => {
    const interceptorWorker = new BrowserHttpInterceptorWorker({ baseURL: '' });

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(UnregisteredServiceWorkerError);
  });

  it('should throw an error after failing to start due to a unknown error', async () => {
    const interceptorWorker = new BrowserHttpInterceptorWorker({ baseURL: '' });

    const unknownError = new Error('Unknown error');
    vi.spyOn(interceptorWorker.worker(), 'start').mockRejectedValueOnce(unknownError);

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(unknownError);
  });
});
