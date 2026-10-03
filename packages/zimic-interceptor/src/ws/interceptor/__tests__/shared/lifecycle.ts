import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorType, WebSocketInterceptorPlatform } from '../../types/options';

interface SharedWebSocketInterceptorLifecycleTestOptions {
  platform: WebSocketInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
}

export function declareWebSocketInterceptorLifecycleTests(options: SharedWebSocketInterceptorLifecycleTestOptions) {
  const { startServer, stopServer, getBaseURL } = options;

  beforeAll(async () => {
    await startServer?.();
  });

  afterAll(async () => {
    await stopServer?.();
  });

  it.each(['local', 'remote'] as const)('should finish stopped after start overlaps stop (%s)', async (type) => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({ type, baseURL: await getBaseURL(type) });

    try {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    } finally {
      await interceptor.stop();
    }
  });

  it.each(['local', 'remote'] as const)('should start after an overlapping stop (%s)', async (type) => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({ type, baseURL: await getBaseURL(type) });

    try {
      await Promise.all([interceptor.start(), interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(options.platform);
    } finally {
      await interceptor.stop();
    }
  });
}
