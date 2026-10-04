import { beforeEach, expect, it } from 'vitest';

import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
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

    interceptor.auth = { token: validToken };

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should be able to start after adding required authentication', async () => {
    const interceptor = createWebSocketInterceptor<{}>({ type: 'remote', baseURL });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);

    interceptor.auth = { token: validToken };

    try {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should share a failed startup between concurrent calls', async () => {
    const interceptor = createWebSocketInterceptor<{}>({ type: 'remote', baseURL });

    await usingIgnoredConsole(['error'], async () => {
      const [firstStartResult, secondStartResult] = await Promise.allSettled([
        interceptor.start(),
        interceptor.start(),
      ]);

      const firstStartRejection = firstStartResult as PromiseRejectedResult;
      expect(firstStartRejection.status).toBe('rejected');
      expect(firstStartRejection.reason).toBeInstanceOf(UnauthorizedWebSocketConnectionError);

      const secondStartRejection = secondStartResult as PromiseRejectedResult;
      expect(secondStartRejection.status).toBe('rejected');
      expect(secondStartRejection.reason).toBe(firstStartRejection.reason);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should not support changing authentication while starting', async () => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth: { token: validToken },
    });

    try {
      const startPromise = interceptor.start();
      expect(() => {
        interceptor.auth!.token = 'other-token';
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
        ),
      );
      await startPromise;
      expect(interceptor.auth?.token).toBe(validToken);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not support assigning authentication while starting', async () => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth: { token: validToken },
    });

    try {
      const startPromise = interceptor.start();
      expect(() => {
        interceptor.auth = { token: 'other-token' };
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
        ),
      );
      await startPromise;
      expect(interceptor.auth?.token).toBe(validToken);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not support changing authentication while stopping during startup', async () => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth: { token: validToken },
    });

    const otherToken = 'other-token';
    expect(otherToken).not.toBe(interceptor.auth?.token);

    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    expect(() => {
      interceptor.auth!.token = otherToken;
    }).toThrow(
      new RunningWebSocketInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
      ),
    );

    await Promise.all([startPromise, stopPromise]);
    expect(interceptor.auth?.token).toBe(validToken);
  });

  it('should not change authentication if the original options object is mutated while starting', async () => {
    const authOptions = { token: validToken };
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth: authOptions,
    });

    expect(interceptor.auth).not.toBe(authOptions);

    try {
      const startPromise = interceptor.start();
      authOptions.token = 'other-token';
      await startPromise;
      expect(interceptor.auth).toEqual({ token: validToken });
    } finally {
      await interceptor.stop();
    }
  });
}
