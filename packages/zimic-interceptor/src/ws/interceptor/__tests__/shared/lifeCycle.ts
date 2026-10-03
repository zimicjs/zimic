import { expect, it } from 'vitest';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
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
}
