import { expect, it } from 'vitest';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../types/options';

interface SharedWebSocketInterceptorLifeCycleTestOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareLifeCycleWebSocketInterceptorTests(options: SharedWebSocketInterceptorLifeCycleTestOptions) {
  const { platform, type, getBaseURL } = options;

  it('should stop when called while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    try {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    } finally {
      await interceptor.stop();
    }
  });

  it('should start when called after stopping while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });

    try {
      await Promise.all([interceptor.start(), interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not support changing the base URL while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;
    let startPromise: Promise<void> | undefined;

    try {
      startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = new URL('new', baseURL).toString();
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled(startPromise ? [startPromise] : []);
      await interceptor.stop();
    }
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;
    const otherBaseURL = new URL('new', baseURL).toString();

    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    try {
      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled([startPromise, stopPromise]);
      await interceptor.stop();
    }
  });
}
