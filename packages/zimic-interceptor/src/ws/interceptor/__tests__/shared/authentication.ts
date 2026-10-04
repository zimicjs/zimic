import { beforeEach, expect, it } from 'vitest';

import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';

import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorPlatform } from '../../types/options';

interface SharedAuthenticationWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  getBaseURL: () => string;
  getValidToken: () => string;
}

export function declareAuthenticationWebSocketInterceptorTests(
  options: SharedAuthenticationWebSocketInterceptorTestsOptions,
) {
  const { platform, getBaseURL, getValidToken } = options;

  let baseURL: string;
  let validToken: string;

  beforeEach(() => {
    baseURL = getBaseURL();
    validToken = getValidToken();
  });

  it('should start with valid credentials', async () => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth: { token: validToken },
    });

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
    } finally {
      await interceptor.stop();
    }
  });

  it.each([
    { name: 'missing', auth: undefined },
    { name: 'invalid', auth: { token: 'invalid-token' } },
  ])('should reject $name credentials', async ({ auth }) => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth,
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should create a fresh worker after an authentication failure', async () => {
    const auth = { token: 'invalid-token' };
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth,
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);

    auth.token = validToken;

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });
}
