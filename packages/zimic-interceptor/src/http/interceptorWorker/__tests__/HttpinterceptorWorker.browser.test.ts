import { describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { HttpInterceptorPlatform } from '../../interceptor/types/options';
import UnregisteredBrowserServiceWorkerError from '../errors/UnregisteredBrowserServiceWorkerError';
import { createHttpInterceptorWorker } from '../factory';
import { BrowserHttpWorker } from '../types/requests';
import { declareDefaultHttpInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe('HttpInterceptorWorker (browser)', () => {
  it('should throw an error if trying to start without a registered service worker', async () => {
    const interceptorWorker = createHttpInterceptorWorker({ type: 'local' });

    // As of @vitest/browser@2.1.3, specifically https://github.com/vitest-dev/vitest/pull/6687, an MSW worker is always
    // registered by default in the browser. Because of that, we cannot reliably simulate the real error thrown by the
    // absence of a worker. As a workaround, we're mocking the worker start method to throw a synthetic error.
    // This is not ideal, but no other solutions appear to be available at the moment.
    const unavailableMSWWorkerScriptError = new Error(
      [
        "[MSW] Failed to register a Service Worker for scope ('http://localhost:5173/') with script " +
          "('http://localhost:5173/mockServiceWorker.js'): Service Worker script does not exist at the given path.\n",
        'Did you forget to run "npx msw init <PUBLIC_DIR>"?\n',
        'Learn more about creating the Service Worker script: https://mswjs.io/docs/cli/init`',
      ].join('\n'),
    );

    const mswWorker = interceptorWorker.internalWorkerOrCreate() as BrowserHttpWorker;
    vi.spyOn(mswWorker, 'start').mockRejectedValueOnce(unavailableMSWWorkerScriptError);

    await usingIgnoredConsole(['error'], async (spies) => {
      const interceptorStartPromise = interceptorWorker.start();

      const expectedError = new UnregisteredBrowserServiceWorkerError();
      await expect(interceptorStartPromise).rejects.toThrowError(expectedError);

      expect(spies.error).toHaveBeenCalledTimes(0);
    });

    expect(interceptorWorker.platform()).toBe<HttpInterceptorPlatform>('browser');
  });
});

describe.each(testMatrix)('HttpInterceptorWorker (browser, $type)', (defaultWorkerOptions) => {
  declareDefaultHttpInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: getBrowserBaseURL,
  });
});
