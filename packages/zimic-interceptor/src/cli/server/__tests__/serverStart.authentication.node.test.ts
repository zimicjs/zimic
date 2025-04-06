import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotRunningHttpInterceptorError } from '@/http';
import { createHttpInterceptor } from '@/http/interceptor/factory';
import InvalidInterceptorTokenValueError from '@/server/errors/InvalidInterceptorTokenValueError';
import {
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  listInterceptorTokens,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { PROCESS_EXIT_EVENTS } from '@/utils/processes';
import UnauthorizedWebSocketConnectionError from '@/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import runCLI from '../../cli';
import { serverSingleton as server } from '../start';
import { clearInterceptorTokens } from '../token/__tests__/utils';
import { createInterceptorServerToken } from '../token/create';

describe('CLI > Server start > Authentication', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(async () => {
    processArgvSpy.mockReturnValue([]);

    await clearInterceptorTokens();
  });

  afterEach(async () => {
    await server?.stop();

    for (const exitEvent of PROCESS_EXIT_EVENTS) {
      process.removeAllListeners(exitEvent);
    }
  });

  afterAll(async () => {
    await clearInterceptorTokens();
  });

  it('should allow an unauthenticated interceptor connection if not using a token directory', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--port', '5001']);

    await usingIgnoredConsole(['info'], async () => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(undefined);

      await usingHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>(
        {
          type: 'remote',
          baseURL: 'http://localhost:5001',
          auth: undefined,
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch('http://localhost:5001/users');
          expect(response.status).toBe(204);
        },
      );
    });
  });

  it('should not allow an unauthenticated interceptor connection if using a token directory', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: undefined,
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledWith(expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });

  it('should allow an authenticated interceptor connection if using a token directory and a valid token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info'], async () => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await usingHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>(
        {
          type: 'remote',
          baseURL: 'http://localhost:5001',
          auth: { token: token.value },
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch('http://localhost:5001/users');
          expect(response.status).toBe(204);
        },
      );
    });
  });

  it('should not allow an interceptor connection if using a token directory and an invalid token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const invalidTokenValue = 'invalid';

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: { token: invalidTokenValue },
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(2);
      expect(spies.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(spies.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });

  it('should not allow an interceptor connection if using a token directory and an invalid token secret', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const invalidTokenValue = `${token.value.slice(0, -1)}!`;
      expect(invalidTokenValue.length).toBe(token.value.length);
      expect(invalidTokenValue).not.toBe(token.value);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: { token: invalidTokenValue },
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(2);
      expect(spies.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(spies.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });

  it('should not allow an interceptor connection if using a token directory and an invalid, too long token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const invalidTokenValue = `${token.value}a`;
      expect(invalidTokenValue.length).toBeGreaterThan(token.value.length);
      expect(invalidTokenValue).not.toBe(token.value);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: { token: invalidTokenValue },
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(2);
      expect(spies.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(spies.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });

  it('should not allow an interceptor connection if using a token directory and an invalid, too short token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const invalidTokenValue = token.value.slice(0, -1);
      expect(invalidTokenValue.length).toBeLessThan(token.value.length);
      expect(invalidTokenValue).not.toBe(token.value);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: { token: invalidTokenValue },
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(2);
      expect(spies.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(spies.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });

  it('should not allow an interceptor connection if using a token directory and a removed token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--port',
      '5001',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['info', 'error'], async (spies) => {
      const token = await createInterceptorServerToken({
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      let tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(5001);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await usingHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>(
        {
          type: 'remote',
          baseURL: 'http://localhost:5001',
          auth: { token: token.value },
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch('http://localhost:5001/users');
          expect(response.status).toBe(204);
        },
      );

      await removeInterceptorToken(token.id, {
        tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      });

      tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(0);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
        auth: { token: token.value },
      });

      await expect(interceptor.start()).rejects.toThrowError(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(spies.error).toHaveBeenCalledTimes(2);
      expect(spies.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(token.value));
      expect(spies.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrowError(new NotRunningHttpInterceptorError());
    });
  });
});
