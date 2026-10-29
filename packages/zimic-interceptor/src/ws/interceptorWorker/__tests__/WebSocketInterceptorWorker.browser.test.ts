import { describe, expect, it, vi } from 'vitest';

import UnregisteredBrowserServiceWorkerError from '@/interceptor/errors/UnregisteredBrowserServiceWorkerError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { getBrowserBaseURL, usingWebSocketInterceptorWorker } from '@tests/utils/interceptors';

import { WebSocketInterceptorPlatform } from '../../interceptor/types/options';
import { BrowserMSWWorker } from '../types/msw';
import { declareDefaultWebSocketInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe('WebSocketInterceptorWorker > Browser', () => {
  it('should throw an error if trying to start without a registered service worker', async () => {
    await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (interceptorWorker) => {
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

      const mswWorker = (await interceptorWorker.getMSWWorkerOrCreate()) as BrowserMSWWorker;
      vi.spyOn(mswWorker, 'start').mockRejectedValueOnce(unavailableMSWWorkerScriptError);

      await usingIgnoredConsole(['error'], async (console) => {
        const interceptorStartPromise = interceptorWorker.start();

        const expectedError = new UnregisteredBrowserServiceWorkerError();
        await expect(interceptorStartPromise).rejects.toThrow(expectedError);

        expect(console.error).toHaveBeenCalledTimes(0);
      });

      expect(interceptorWorker.platform).toBe<WebSocketInterceptorPlatform>('browser');
    });
  });
});

describe.each(testMatrix)('WebSocketInterceptorWorker (browser, $type)', (defaultWorkerOptions) => {
  declareDefaultWebSocketInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    // In the browser, unhandled promise rejections are logged automatically, so the worker does not log start errors.
    numberOfLoggedStartErrors: 0,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
