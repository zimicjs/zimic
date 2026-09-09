import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  InterceptorToken,
  removeInterceptorToken,
} from '@/server/utils/auth';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
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

  it('should start after correcting invalid authentication', async () => {
    const invalidToken = 'invalid-token';
    expect(invalidToken).not.toBe(token.value);

    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth: { token: invalidToken },
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

    interceptor.auth!.token = token.value;

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe('node');
    } finally {
      await interceptor.stop();
    }
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
        interceptor.auth!.token = 'other-token';
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
        ),
      );

      await startPromise;
    } finally {
      await interceptor.stop();
    }
  });

  it('should copy authentication when created', async () => {
    const auth = { token: token.value };
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL: `http://localhost:${server.port}`,
      auth,
    });

    try {
      const startPromise = interceptor.start();
      auth.token = 'other-token';

      await startPromise;
      expect(interceptor.auth).toEqual({ token: token.value });
    } finally {
      await interceptor.stop();
    }
  });
});
