import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  InterceptorToken,
  removeInterceptorToken,
} from '@/server/utils/auth';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import RunningHttpInterceptorError from '../errors/RunningHttpInterceptorError';
import { createHttpInterceptor } from '../factory';

describe('HttpInterceptor (node, remote) > Authentication', () => {
  const server = createInternalInterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });

  let token: InterceptorToken;

  beforeEach(async () => {
    token = await createInterceptorToken();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await removeInterceptorToken(token.id);
  });

  it('should allow starting with valid authentication', async () => {
    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server.port}`,
        auth: { token: token.value },
      },
      async (interceptor) => {
        const handler = await interceptor.get('/users').respond({ status: 204 });
        const response = await fetch(`${interceptor.baseURL}/users`);

        expect(response.status).toBe(204);
        expect(handler.requests).toHaveLength(1);
      },
    );
  });

  it('should not allow starting without authentication if the interceptor server requires it', async () => {
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should be able to start after correcting invalid authentication', async () => {
    const invalidToken = 'invalid-token';
    expect(invalidToken).not.toBe(token.value);

    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: { token: invalidToken },
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);

    interceptor.auth!.token = token.value;

    try {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe('node');
    } finally {
      await interceptor.stop();
    }
  });

  it('should share a failed startup between concurrent calls', async () => {
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: { token: 'invalid-token' },
    });

    await usingIgnoredConsole(['error'], async () => {
      const [firstStartResult, secondStartResult] = await Promise.allSettled([
        interceptor.start(),
        interceptor.start(),
      ]);

      if (firstStartResult.status !== 'rejected' || secondStartResult.status !== 'rejected') {
        throw new Error('Expected both interceptor starts to reject.');
      }

      expect(firstStartResult.reason).toBeInstanceOf(UnauthorizedWebSocketConnectionError);
      expect(secondStartResult.reason).toBe(firstStartResult.reason);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
  });

  it('should not support changing authentication while starting', async () => {
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: { token: token.value },
    });

    try {
      const startPromise = interceptor.start();

      expect(() => {
        interceptor.auth = { token: 'other-token' };
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
        ),
      );

      expect(interceptor.auth?.token).toBe(token.value);

      expect(() => {
        interceptor.auth!.token = 'other-token';
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
        ),
      );

      expect(interceptor.auth?.token).toBe(token.value);

      await startPromise;

      expect(interceptor.auth?.token).toBe(token.value);
    } finally {
      await interceptor.stop();
    }
  });

  it('should not support changing authentication while stopping during startup', async () => {
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: { token: token.value },
    });

    const otherToken = 'other-token';
    expect(otherToken).not.toBe(interceptor.auth?.token);

    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    expect(() => {
      interceptor.auth!.token = otherToken;
    }).toThrow(
      new RunningHttpInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
      ),
    );

    await Promise.all([startPromise, stopPromise]);

    expect(interceptor.auth?.token).toBe(token.value);
  });

  it('should not change authentication if the original options object is mutated while starting', async () => {
    const authOptions = { token: token.value };

    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: authOptions,
    });

    expect(interceptor.auth).not.toBe(authOptions);

    try {
      const startPromise = interceptor.start();
      authOptions.token = 'other-token';

      await startPromise;

      expect(interceptor.auth).toEqual({ token: token.value });
    } finally {
      await interceptor.stop();
    }
  });
});
