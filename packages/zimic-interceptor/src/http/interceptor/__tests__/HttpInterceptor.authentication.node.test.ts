import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import HttpInterceptorStore from '@/http/interceptor/HttpInterceptorStore';
import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  InterceptorToken,
  removeInterceptorToken,
} from '@/server/utils/auth';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { createHttpInterceptor } from '../factory';

describe('HttpInterceptor (node, remote) > Authentication', () => {
  const store = new HttpInterceptorStore();

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

  it('should create a fresh worker after an authentication failure', async () => {
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

    let remoteWorker = store.getRemoteWorker(new URL(interceptor.baseURL), { auth: interceptor.auth });
    expect(remoteWorker).toBe(undefined);

    interceptor.auth!.token = token.value;

    try {
      await expect(interceptor.start()).resolves.toBeUndefined();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe('node');

      remoteWorker = store.getRemoteWorker(new URL(interceptor.baseURL), { auth: interceptor.auth });
      expect(remoteWorker).toBeDefined();
    } finally {
      await interceptor.stop();
    }

    remoteWorker = store.getRemoteWorker(new URL(interceptor.baseURL), { auth: interceptor.auth });
    expect(remoteWorker).toBe(undefined);
  });
});
