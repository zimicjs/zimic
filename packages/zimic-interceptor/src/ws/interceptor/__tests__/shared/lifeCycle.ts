import { beforeEach, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, getInterceptorOptions } = options;

  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    interceptorOptions = getInterceptorOptions();
  });

  it('should initialize with the correct platform', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.platform).toBe(null);

    await interceptor.start();
    expect(interceptor.platform).toBe(platform);

    await interceptor.stop();
    expect(interceptor.platform).toBe(null);
  });

  it('should not throw if started or stopped multiple times', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);

    await interceptor.start();
    await interceptor.start();

    expect(interceptor.isRunning).toBe(true);

    await interceptor.stop();
    await interceptor.stop();

    expect(interceptor.isRunning).toBe(false);
  });

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);
    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should clear handler state', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      interceptor.message().respond({}).times(1);

      await expect(async () => {
        await interceptor.checkTimes();
      }).rejects.toThrow('Expected exactly 1 message, but got 0.');

      await interceptor.clear();
      await interceptor.checkTimes();
    });
  });
}
