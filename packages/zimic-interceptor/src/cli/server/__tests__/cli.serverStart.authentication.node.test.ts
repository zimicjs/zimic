import { HttpSchema } from '@zimic/http';
import { PROCESS_EXIT_EVENTS } from '@zimic/utils/process';
import color from 'picocolors';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import { NotRunningHttpInterceptorError, RemoteHttpInterceptorOptions } from '@/http';
import { createHttpInterceptor } from '@/http/interceptor/factory';
import InvalidInterceptorTokenValueError from '@/server/errors/InvalidInterceptorTokenValueError';
import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  listInterceptorTokens,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { LOOPBACK_HOSTNAMES } from '@/utils/http';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import runCLI from '../../cli';
import { serverSingleton as server } from '../start';
import { clearInterceptorTokens } from '../token/__tests__/utils';

const clientSocketDefaults = vi.hoisted<WebSocket.ClientOptions>(() => ({}));

vi.mock('isomorphic-ws', async (importOriginal) => {
  const module = await importOriginal<{ default: typeof import('isomorphic-ws') }>();
  const OriginalClientSocket = module.default;

  return {
    ...module,
    // ClientSocket has no way of setting default options. Some of the tests in this file need to force custom
    // headers, so this mock class is used to override the default options..
    default: class ClientSocket extends OriginalClientSocket {
      constructor(
        address: URL | string,
        protocols?: string | string[],
        options: WebSocket.ClientOptions = clientSocketDefaults,
      ) {
        super(address, protocols, options);
      }
    },
  };
});

describe('CLI > Server start > Authentication', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(async () => {
    processArgvSpy.mockReturnValue([]);
    clientSocketDefaults.headers = {};

    await clearInterceptorTokens();
  });

  afterEach(async () => {
    await server?.stop();
    vi.unstubAllEnvs();

    for (const exitEvent of PROCESS_EXIT_EVENTS) {
      process.removeAllListeners(exitEvent);
    }
  });

  afterAll(async () => {
    await clearInterceptorTokens();
  });

  it('should allow an unauthenticated interceptor connection if not using a token directory', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(undefined);

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
        auth: undefined,
      },
      async (interceptor) => {
        expect(interceptor.isRunning).toBe(true);

        await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);
      },
    );
  });

  it('should not allow an unauthenticated interceptor connection if using a token directory', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>({
      type: 'remote',
      baseURL: `http://localhost:${server!.port}`,
      auth: undefined,
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(expect.any(UnauthorizedWebSocketConnectionError));

      const error = console.error.mock.calls[0][0] as UnauthorizedWebSocketConnectionError;
      expect(error.event.reason).toBe('An interceptor token is required, but none was provided.');
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should allow an authenticated interceptor connection if using a token directory and a valid token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
        auth: { token: token.value },
      },
      async (interceptor) => {
        expect(interceptor.isRunning).toBe(true);

        await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);
      },
    );
  });

  it('should allow an authenticated interceptor connection if using a token directory and changing valid tokens', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();
    const otherToken = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].id).toBe(token.id);
    expect(tokens[1].id).toBe(otherToken.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
        auth: { token: token.value },
      },
      async (interceptor) => {
        expect(interceptor.auth).toEqual<RemoteHttpInterceptorOptions['auth']>({ token: token.value });
        expect(interceptor.isRunning).toBe(true);

        await interceptor.get('/users').respond({ status: 204 });

        let response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        await removeInterceptorToken(token.id);

        await usingIgnoredConsole(['error'], async (console) => {
          await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

          expect(interceptor.isRunning).toBe(false);

          expect(console.error).toHaveBeenCalledTimes(2);
          expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(token.value));
          expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
        });

        interceptor.auth = { token: otherToken.value };
        expect(interceptor.auth).toEqual<RemoteHttpInterceptorOptions['auth']>({ token: otherToken.value });

        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        await interceptor.get('/users').respond({ status: 204 });

        response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);
      },
    );
  });

  it.each([
    'invalid',
    'c70ccbce',
    'b087f533-147f-4ff4-8b8e-5261f42087ee',
    'package.json',
    './src/index.ts',
    '/tmp/secret',
    '../../../tmp/secret',
  ])(
    'should not allow an interceptor connection if using a token directory and an invalid token: %s',
    async (invalidTokenValue) => {
      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--tokens-dir',
        DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      ]);

      const token = await createInterceptorToken();

      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe(token.id);

      await usingIgnoredConsole(['log'], async () => {
        await runCLI();
      });

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
        auth: { token: invalidTokenValue },
      });

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

        expect(interceptor.isRunning).toBe(false);

        expect(console.error).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
        expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));

        const error = console.error.mock.calls[1][0] as UnauthorizedWebSocketConnectionError;
        expect(error.event.reason).toBe('The interceptor token is not valid.');
      });

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrow(new NotRunningHttpInterceptorError());
    },
  );

  it('should not allow an interceptor connection if using a token directory and an invalid token more than once', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    const invalidTokenValue = 'invalid';

    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>({
      type: 'remote',
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: invalidTokenValue },
    });

    const numberOfRetries = 3;

    for (let retry = 0; retry < numberOfRetries; retry++) {
      await usingIgnoredConsole(['error'], async (console) => {
        await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

        expect(interceptor.isRunning).toBe(false);

        expect(console.error).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
        expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
      });

      await expect(async () => {
        await interceptor.get('/users').respond({ status: 204 });
      }).rejects.toThrow(new NotRunningHttpInterceptorError());
    }
  });

  it('should not allow an interceptor connection if using a token directory and a token with incorrect secret', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();
    const otherToken = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);
    expect(tokens[0].id).toBe(token.id);
    expect(tokens[1].id).toBe(otherToken.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    const invalidTokenValue = Buffer.from(`${token.id}${otherToken.secret.value}`, 'hex').toString('base64url');

    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>({
      type: 'remote',
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: invalidTokenValue },
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should not allow an interceptor connection if using a token directory and an invalid token secret', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
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
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: invalidTokenValue },
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should not allow an interceptor connection if using a token directory and an invalid, too long token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
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
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: invalidTokenValue },
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should not allow an interceptor connection if using a token directory and an invalid, too short token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
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
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: invalidTokenValue },
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(invalidTokenValue));
      expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should not allow an interceptor connection if using a token directory and a removed token', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    const token = await createInterceptorToken();

    let tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(token.id);

    await usingIgnoredConsole(['log'], async () => {
      await runCLI();
    });

    expect(server).toBeDefined();
    expect(server!.isRunning).toBe(true);
    expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
        auth: { token: token.value },
      },
      async (interceptor) => {
        expect(interceptor.isRunning).toBe(true);

        await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);
      },
    );

    await removeInterceptorToken(token.id);

    tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(0);

    const interceptor = createHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>({
      type: 'remote',
      baseURL: `http://localhost:${server!.port}`,
      auth: { token: token.value },
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(interceptor.start()).rejects.toThrow(UnauthorizedWebSocketConnectionError);

      expect(interceptor.isRunning).toBe(false);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(1, new InvalidInterceptorTokenValueError(token.value));
      expect(console.error).toHaveBeenNthCalledWith(2, expect.any(UnauthorizedWebSocketConnectionError));
    });

    await expect(async () => {
      await interceptor.get('/users').respond({ status: 204 });
    }).rejects.toThrow(new NotRunningHttpInterceptorError());
  });

  it('should show a warning if started on a non-loopback hostname without a token directory', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', '0.0.0.0']);

    await usingIgnoredConsole(['log', 'warn'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('0.0.0.0');
      expect(server!.port).toEqual(expect.any(Number));
      expect(server!.tokensDirectory).toBe(undefined);

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        [
          `Attention: this interceptor server is ${color.bold(color.red('unprotected'))}. Do not expose it publicly ` +
            'without authentication.',
          '',
          'For your safety, this server will reject remote browser interceptors until authentication is configured.',
          '',
          'In @zimic/interceptor v2, interceptor servers running on non-loopback hostnames will require ' +
            'authentication and refuse to start without a tokens directory.',
          '',
          'Learn more: https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication',
        ].join('\n'),
      );
    });
  });

  it('should show an unprotected warning if started on a loopback hostname in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', 'localhost']);

    await usingIgnoredConsole(['log', 'warn'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.tokensDirectory).toBe(undefined);

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        [
          `Attention: this interceptor server is ${color.bold(color.red('unprotected'))}. Do not expose it publicly ` +
            'without authentication.',
          '',
          'For your safety, this server will reject remote browser interceptors until authentication is configured.',
          '',
          'In @zimic/interceptor v2, interceptor servers running on non-loopback hostnames will require ' +
            'authentication and refuse to start without a tokens directory.',
          '',
          'Learn more: https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication',
        ].join('\n'),
      );
    });
  });

  it.each(['development', 'test'])(
    'should not show an unprotected warning if started on a loopback hostname in %s',
    async (nodeEnvironment) => {
      vi.stubEnv('NODE_ENV', nodeEnvironment);
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', 'localhost']);

      await usingIgnoredConsole(['log', 'warn'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe('localhost');
        expect(server!.tokensDirectory).toBe(undefined);

        expect(console.warn).not.toHaveBeenCalled();
      });
    },
  );

  it.each([...LOOPBACK_HOSTNAMES, 'LOCALHOST'])(
    'should not show an unprotected warning if started on %s without a token directory',
    async (hostname) => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', hostname]);

      await usingIgnoredConsole(['log', 'warn'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe(hostname);
        expect(server!.tokensDirectory).toBe(undefined);

        expect(console.warn).not.toHaveBeenCalled();
      });
    },
  );

  it('should not show an unprotected warning if started on a non-loopback hostname with a token directory', async () => {
    processArgvSpy.mockReturnValue([
      'node',
      './dist/cli.js',
      'server',
      'start',
      '--hostname',
      '0.0.0.0',
      '--tokens-dir',
      DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    ]);

    await usingIgnoredConsole(['log', 'warn'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('0.0.0.0');
      expect(server!.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket origin validation', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>;

    describe.each([
      { serverHostname: 'localhost', clientHostname: 'localhost' },
      { serverHostname: '0.0.0.0', clientHostname: '127.0.0.1' },
    ])('Authenticated $serverHostname server', ({ serverHostname, clientHostname }) => {
      it.each([undefined, '', 'http://localhost:4000', 'https://example.com', 'null', 'not an origin'])(
        'should allow a valid token with origin %s',
        async (origin) => {
          const token = await createInterceptorToken();

          processArgvSpy.mockReturnValue([
            'node',
            './dist/cli.js',
            'server',
            'start',
            '--hostname',
            serverHostname,
            '--tokens-dir',
            DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
          ]);

          await usingIgnoredConsole(['log'], async () => {
            await runCLI();
          });

          expect(server).toBeDefined();
          expect(server!.isRunning).toBe(true);

          clientSocketDefaults.headers = origin === undefined ? {} : { origin };

          await usingHttpInterceptor<Schema>(
            {
              type: 'remote',
              baseURL: `http://${clientHostname}:${server!.port}`,
              auth: { token: token.value },
            },
            async (interceptor) => {
              expect(interceptor.isRunning).toBe(true);

              const handler = await interceptor.get('/users').respond({ status: 204 });

              const response = await fetch(`${interceptor.baseURL}/users`);
              expect(response.status).toBe(204);

              expect(handler.requests).toHaveLength(1);
            },
          );
        },
      );

      it.each([
        {
          token: undefined,
          origin: undefined,
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: undefined,
          origin: '',
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: undefined,
          origin: 'http://localhost:4000',
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: undefined,
          origin: 'https://example.com',
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: undefined,
          origin: 'null',
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: undefined,
          origin: 'not an origin',
          reason: 'An interceptor token is required, but none was provided.',
        },
        {
          token: 'invalid',
          origin: undefined,
          reason: 'The interceptor token is not valid.',
        },
        {
          token: 'invalid',
          origin: '',
          reason: 'The interceptor token is not valid.',
        },
        {
          token: 'invalid',
          origin: 'http://localhost:4000',
          reason: 'The interceptor token is not valid.',
        },
        {
          token: 'invalid',
          origin: 'https://example.com',
          reason: 'The interceptor token is not valid.',
        },
        {
          token: 'invalid',
          origin: 'null',
          reason: 'The interceptor token is not valid.',
        },
        {
          token: 'invalid',
          origin: 'not an origin',
          reason: 'The interceptor token is not valid.',
        },
      ])('should reject token $token with origin $origin', async ({ token, origin, reason }) => {
        processArgvSpy.mockReturnValue([
          'node',
          './dist/cli.js',
          'server',
          'start',
          '--hostname',
          serverHostname,
          '--tokens-dir',
          DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
        ]);

        await usingIgnoredConsole(['log'], async () => {
          await runCLI();
        });

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);

        clientSocketDefaults.headers = origin === undefined ? {} : { origin };

        const interceptor = createHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${clientHostname}:${server!.port}`,
          auth: token ? { token } : undefined,
        });

        await usingIgnoredConsole(['error'], async () => {
          await expect(interceptor.start()).rejects.toThrow(`${reason} (code 1008)`);

          expect(interceptor.isRunning).toBe(false);

          await expect(async () => {
            await interceptor.get('/users').respond({ status: 204 });
          }).rejects.toThrow(new NotRunningHttpInterceptorError());
        });
      });
    });

    it.each(LOOPBACK_HOSTNAMES)('should allow no-origin clients on unauthenticated %s servers', async (hostname) => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', hostname]);

      await usingIgnoredConsole(['log'], async () => {
        await runCLI();
      });

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);

      const serverURLHostname = hostname === '::1' ? `[${hostname}]` : hostname;
      await usingHttpInterceptor<Schema>(
        {
          type: 'remote',
          baseURL: `http://${serverURLHostname}:${server!.port}`,
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          const handler = await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch(`${interceptor.baseURL}/users`);
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
        },
      );
    });

    describe.each([...LOOPBACK_HOSTNAMES, 'LOCALHOST'])('Unauthenticated %s server', (serverHostname) => {
      it.each(LOOPBACK_HOSTNAMES)('should allow browser origin on %s with a different port', async (originHostname) => {
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', serverHostname]);

        await usingIgnoredConsole(['log'], async () => {
          await runCLI();
        });

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);

        expect(server!.port).toBeDefined();

        const serverURLHostname = serverHostname === '::1' ? `[${serverHostname}]` : serverHostname;
        const originURLHostname = originHostname === '::1' ? `[${originHostname}]` : originHostname;

        const originPort = server!.port! + 1;
        expect(originPort).not.toBe(server!.port);

        clientSocketDefaults.headers = { origin: `http://${originURLHostname}:${originPort}` };

        await usingHttpInterceptor<Schema>(
          {
            type: 'remote',
            baseURL: `http://${serverURLHostname}:${server!.port}`,
          },
          async (interceptor) => {
            expect(interceptor.isRunning).toBe(true);

            const handler = await interceptor.get('/users').respond({ status: 204 });

            const response = await fetch(`${interceptor.baseURL}/users`);
            expect(response.status).toBe(204);

            expect(handler.requests).toHaveLength(1);
          },
        );
      });

      it.each([
        '',
        'https://example.com',
        'not an origin',
        'null',
        'http://127.0.0.2',
        'http://127.1',
        'http://2130706433',
        'http://[0:0:0:0:0:0:0:1]',
        'http://localhost.localdomain',
        'http://localhost/path',
        'data://localhost',
      ])('should reject browser origin %s', async (origin) => {
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', serverHostname]);

        await usingIgnoredConsole(['log'], async () => {
          await runCLI();
        });

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);

        const serverURLHostname = serverHostname === '::1' ? `[${serverHostname}]` : serverHostname;
        clientSocketDefaults.headers = { origin };

        const interceptor = createHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${serverURLHostname}:${server!.port}`,
        });

        await usingIgnoredConsole(['error'], async () => {
          await expect(interceptor.start()).rejects.toThrow(
            'Unauthenticated browser connections are only allowed from loopback origins. ' +
              'Configure token authentication. (code 1008)',
          );

          expect(interceptor.isRunning).toBe(false);

          await expect(async () => {
            await interceptor.get('/users').respond({ status: 204 });
          }).rejects.toThrow(new NotRunningHttpInterceptorError());
        });
      });
    });

    it('should allow no-origin clients on unauthenticated non-loopback servers', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', '0.0.0.0']);

      await usingIgnoredConsole(['log'], async () => {
        await runCLI();
      });

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);

      await usingHttpInterceptor<Schema>(
        {
          type: 'remote',
          baseURL: `http://127.0.0.1:${server!.port}`,
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          const handler = await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch(`${interceptor.baseURL}/users`);
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
        },
      );
    });

    it.each(['', 'http://localhost:4000', 'https://example.com', 'not an origin', 'null'])(
      'should reject browser origin %s on unauthenticated non-loopback servers',
      async (origin) => {
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--hostname', '0.0.0.0']);

        await usingIgnoredConsole(['log'], async () => {
          await runCLI();
        });

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);

        clientSocketDefaults.headers = { origin };

        const interceptor = createHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://127.0.0.1:${server!.port}`,
        });

        await usingIgnoredConsole(['error'], async () => {
          await expect(interceptor.start()).rejects.toThrow(
            'Unauthenticated browser connections are only allowed from loopback origins. ' +
              'Configure token authentication. (code 1008)',
          );

          expect(interceptor.isRunning).toBe(false);

          await expect(async () => {
            await interceptor.get('/users').respond({ status: 204 });
          }).rejects.toThrow(new NotRunningHttpInterceptorError());
        });
      },
    );

    it('should still accept new interceptor clients after rejecting an untrusted browser origin', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async () => {
        await runCLI();
      });

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);

      clientSocketDefaults.headers = { origin: 'https://example.com' };

      const untrustedInterceptor = createHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server!.hostname}:${server!.port}`,
      });

      await usingIgnoredConsole(['error'], async () => {
        await expect(untrustedInterceptor.start()).rejects.toThrow(
          'Unauthenticated browser connections are only allowed from loopback origins. ' +
            'Configure token authentication. (code 1008)',
        );
        expect(untrustedInterceptor.isRunning).toBe(false);
      });

      clientSocketDefaults.headers = {};

      await usingHttpInterceptor<Schema>(
        {
          type: 'remote',
          baseURL: `http://${server!.hostname}:${server!.port}`,
        },
        async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          const handler = await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch(`${interceptor.baseURL}/users`);
          expect(response.status).toBe(204);

          expect(handler.requests).toHaveLength(1);
        },
      );
    });
  });
});
