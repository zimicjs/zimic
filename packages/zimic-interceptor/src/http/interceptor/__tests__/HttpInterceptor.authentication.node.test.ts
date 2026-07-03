import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import InterceptorStore from '@/interceptor/InterceptorStore';
import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  removeInterceptorToken,
} from '@/server/utils/auth';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { createHttpInterceptor } from '../factory';

describe('HttpInterceptor (node, remote) > Authentication', () => {
  const store = new InterceptorStore();
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

  it('should create a fresh worker after an authentication failure', async () => {
    const baseURL = `http://localhost:${server.port}/api`;
    const auth = { token: 'invalid-token' };
    const interceptor = createHttpInterceptor<{}>({
      type: 'remote',
      baseURL,
      auth,
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);
    });

    expect(interceptor.isRunning).toBe(false);
    expect(interceptor.platform).toBe(null);
    expect(store.remoteWorker(new URL(baseURL), { auth })).toBe(undefined);

    auth.token = token.value;

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe('node');
      expect(store.remoteWorker(new URL(baseURL), { auth })).toBeDefined();
    } finally {
      await interceptor.stop();
    }

    expect(store.remoteWorker(new URL(baseURL), { auth })).toBe(undefined);
  });
});
