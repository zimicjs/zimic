import { describe, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';

import { HttpInterceptorPlatform } from '../../interceptor/types/options';
import UnregisteredBrowserServiceWorkerError from '../errors/UnregisteredBrowserServiceWorkerError';
import { createHttpInterceptorWorker } from '../factory';

describe('HttpInterceptorWorker (browser, no worker)', () => {
  const platform = 'browser' satisfies HttpInterceptorPlatform;

  it('should throw an error after failing to start without a registered service worker', async () => {
    const interceptorWorker = createHttpInterceptorWorker({
      type: 'local',
    });

    const error = new UnregisteredBrowserServiceWorkerError();

    await usingIgnoredConsole(['error'], async (spies) => {
      const interceptorStartPromise = interceptorWorker.start();
      await expect(interceptorStartPromise).rejects.toThrowError(error);

      expect(spies.error).toHaveBeenCalledTimes(0);
    });

    expect(interceptorWorker.platform()).toBe(platform);
  });
});
