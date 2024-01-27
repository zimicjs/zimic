import { describe, expect, it } from 'vitest';

import BrowserHttpInterceptorWorker from '../BrowserHttpInterceptorWorker';
import UnregisteredBrowserServiceWorkerError from '../errors/UnregisteredBrowserServiceWorkerError';

describe('BrowserHttpInterceptorWorker (no worker)', () => {
  it('should throw an error after trying to start without a registered service worker', async () => {
    const interceptorWorker = new BrowserHttpInterceptorWorker({ baseURL: '' });

    const interceptorStartPromise = interceptorWorker.start();
    await expect(interceptorStartPromise).rejects.toThrowError(UnregisteredBrowserServiceWorkerError);
  });
});
