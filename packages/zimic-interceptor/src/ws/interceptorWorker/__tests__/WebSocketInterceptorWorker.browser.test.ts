import { describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { getBrowserBaseURL, usingWebSocketInterceptorWorker } from '@tests/utils/interceptors';

import { WebSocketInterceptorPlatform } from '../../interceptor/types/options';
import UnregisteredBrowserServiceWorkerError from '../errors/UnregisteredBrowserServiceWorkerError';
import LocalWebSocketInterceptorWorker from '../LocalWebSocketInterceptorWorker';
import { BrowserMSWWorker } from '../types/msw';
import { declareDefaultWebSocketInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe('WebSocketInterceptorWorker > Browser', () => {
  it('should throw an error if trying to start without a registered service worker', async () => {
    await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (interceptorWorker) => {
      expect(interceptorWorker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

      if (!(interceptorWorker instanceof LocalWebSocketInterceptorWorker)) {
        throw new Error('Expected a local WebSocket interceptor worker.');
      }

      const unavailableMSWWorkerScriptError = new Error(
        [
          "[MSW] Failed to register a Service Worker for scope ('http://localhost:5173/') with script " +
            "('http://localhost:5173/mockServiceWorker.js'): Service Worker script does not exist at the given path.\n",
          'Did you forget to run "npx msw init <PUBLIC_DIR>"?\n',
          'Learn more about creating the Service Worker script: https://mswjs.io/docs/cli/init`',
        ].join('\n'),
      );

      const mswWorker = (await interceptorWorker.getMSWWorkerOrCreate()) as BrowserMSWWorker;
      const startSpy = vi.spyOn(mswWorker, 'start').mockRejectedValueOnce(unavailableMSWWorkerScriptError);

      await usingIgnoredConsole(['error'], async (console) => {
        const interceptorStartPromise = interceptorWorker.start();

        const expectedError = new UnregisteredBrowserServiceWorkerError();
        await expect(interceptorStartPromise).rejects.toThrow(expectedError);

        expect(console.error).toHaveBeenCalledTimes(0);
      });

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(interceptorWorker.platform).toBe<WebSocketInterceptorPlatform>('browser');
    });
  });
});

describe.each(testMatrix)('WebSocketInterceptorWorker (browser, $type)', (defaultWorkerOptions) => {
  declareDefaultWebSocketInterceptorWorkerTests({
    platform: 'browser',
    defaultWorkerOptions,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
