import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it } from 'vitest';

import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorPlatform } from '../../types/options';

interface SharedAuthenticationWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  getServerURL: () => string;
  getValidToken: () => string;
}

export function declareAuthenticationWebSocketInterceptorTests(
  options: SharedAuthenticationWebSocketInterceptorTestsOptions,
) {
  const { platform, getServerURL, getValidToken } = options;
  let serverURL: string;
  let validToken: string;

  beforeEach(() => {
    serverURL = getServerURL();
    validToken = getValidToken();
  });

  it('should allow starting with valid authentication', async () => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({
      type: 'remote',
      baseURL: serverURL,
      auth: { token: validToken },
    });

    try {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not allow starting without authentication if the interceptor server requires it', async () => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({ type: 'remote', baseURL: serverURL });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should be able to start after adding required authentication', async () => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({ type: 'remote', baseURL: serverURL });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

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
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({ type: 'remote', baseURL: serverURL });

    await usingIgnoredConsole(['error'], async () => {
      const [firstStartResult, secondStartResult] = await Promise.allSettled([
        interceptor.start(),
        interceptor.start(),
      ]);

      expect(firstStartResult.status).toBe('rejected');
      expect(secondStartResult.status).toBe('rejected');
      const firstStartError: unknown = (firstStartResult as PromiseRejectedResult).reason;
      expect(firstStartError).toBeInstanceOf(UnauthorizedWebSocketConnectionError);
      expect((secondStartResult as PromiseRejectedResult).reason).toBe(firstStartError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should not support changing authentication while starting', async () => {
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({
      type: 'remote',
      baseURL: serverURL,
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
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({
      type: 'remote',
      baseURL: serverURL,
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
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({
      type: 'remote',
      baseURL: serverURL,
      auth: { token: validToken },
    });
    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    expect(() => {
      interceptor.auth!.token = 'other-token';
    }).toThrow(
      new RunningWebSocketInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
      ),
    );

    await Promise.all([startPromise, stopPromise]);
    expect(interceptor.auth?.token).toBe(validToken);
  });

  it('should not change authentication if the original options object is mutated while starting', async () => {
    const authOptions: NonNullable<RemoteWebSocketInterceptorOptions['auth']> = { token: validToken };
    const interceptor = createWebSocketInterceptor<WebSocketSchema>({
      type: 'remote',
      baseURL: serverURL,
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
