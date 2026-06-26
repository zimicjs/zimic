import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  removeInterceptorToken,
} from '@/server/utils/auth';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { createWebSocketInterceptor } from '../factory';

describe('WebSocketInterceptor (node, remote) > Authentication', () => {
  const server = createInternalInterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });

  let token: Awaited<ReturnType<typeof createInterceptorToken>>;

  beforeEach(async () => {
    token = await createInterceptorToken();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    await removeInterceptorToken(token.id);
  });

  it('should start with valid credentials', async () => {
    const interceptor = createWebSocketInterceptor<{}>({
      type: 'remote',
      baseURL: `ws://localhost:${server.port}/chat`,
      auth: { token: token.value },
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
      baseURL: `ws://localhost:${server.port}/chat`,
      auth,
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
  });
});
