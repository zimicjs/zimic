import { createInvalidTypeOfCases, ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorAuthOptions, WebSocketInterceptorPlatform } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

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

  it('should allow starting with valid authentication', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { type: 'remote', baseURL, auth: { token: validToken }, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().respond({ type: 'server', text: 'pong' }),
          interceptor,
        );

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', text: 'ping' } satisfies ChatMessage));

          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'pong' }));
          expect(handler.messages).toHaveLength(1);
        });
      },
    );
  });

  it('should not allow starting without authentication if the interceptor server requires it', async () => {
    const interceptor = createWebSocketInterceptor<{}>({ type: 'remote', baseURL });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
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

  const invalidAuths = createInvalidTypeOfCases('object', { optional: true });

  it.each(invalidAuths)(
    'should throw an error if provided an authentication option that is not an object ($label)',
    async ({ value, actualType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid authentication option type.
      const invalidAuth: WebSocketInterceptorAuthOptions = value;

      await expect(async () => {
        await usingWebSocketInterceptor({ type: 'remote', baseURL, auth: invalidAuth }, handler);
      }).rejects.toThrow(new ValidationError(`Expected options.auth to be object, but got ${actualType}.`));

      expect(handler).not.toHaveBeenCalled();
    },
  );

  const invalidTokens = createInvalidTypeOfCases('string');

  it.each(invalidTokens)(
    'should throw an error if provided an authentication token that is not a string ($label)',
    async ({ value, actualType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid authentication token type.
      const invalidToken: string = value;

      await expect(async () => {
        await usingWebSocketInterceptor({ type: 'remote', baseURL, auth: { token: invalidToken } }, handler);
      }).rejects.toThrow(new ValidationError(`Expected options.auth.token to be string, but got ${actualType}.`));

      expect(handler).not.toHaveBeenCalled();
    },
  );
}
