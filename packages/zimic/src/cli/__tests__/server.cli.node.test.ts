import chalk from 'chalk';
import filesystem from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '@/interceptor';
import { verifyUnhandledRequestMessage } from '@/interceptor/http/interceptor/__tests__/shared/utils';
import { createHttpInterceptor } from '@/interceptor/http/interceptor/factory';
import { DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT } from '@/interceptor/server/constants';
import { PossiblePromise } from '@/types/utils';
import { importCrypto } from '@/utils/crypto';
import { HttpServerStartTimeoutError, HttpServerStopTimeoutError } from '@/utils/http';
import { CommandError, PROCESS_EXIT_EVENTS } from '@/utils/processes';
import WebSocketClient from '@/webSocket/WebSocketClient';
import WebSocketServer from '@/webSocket/WebSocketServer';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError } from '@tests/utils/fetch';

import runCLI from '../cli';
import { serverSingleton as server } from '../server/start';
import { delayHttpServerCloseIndefinitely, delayHttpServerListenIndefinitely } from './utils';

function watchExitEventListeners(exitEvent: (typeof PROCESS_EXIT_EVENTS)[number]) {
  const exitEventListeners: (() => PossiblePromise<void>)[] = [];

  vi.spyOn(process, 'on').mockImplementation((event, listener) => {
    if (event === exitEvent) {
      exitEventListeners.push(listener);
    }
    return process;
  });

  return exitEventListeners;
}

describe('CLI (server)', async () => {
  const crypto = await importCrypto();

  const processArgvSpy = vi.spyOn(process, 'argv', 'get');
  const processOnSpy = vi.spyOn(process, 'on');

  beforeEach(() => {
    processArgvSpy.mockClear();
    processArgvSpy.mockReturnValue([]);

    processOnSpy.mockClear();
  });

  const serverHelpOutput = [
    'zimic server',
    '',
    'Interceptor server',
    '',
    'Commands:',
    '  zimic server start [-- onReady]  Start an interceptor server.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', '--help']);
    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(serverHelpOutput);
    });
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server']);

    await usingIgnoredConsole(['error'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(spies.error).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });
  });

  describe('start', () => {
    const temporarySaveDirectory = path.resolve('tmp');
    const temporarySaveFile = path.join(temporarySaveDirectory, 'tmp.txt');

    const serverStartHelpOutput = [
      'zimic server start [-- onReady]',
      '',
      'Start an interceptor server.',
      '',
      'Positionals:',
      '  onReady  A command to run when the server is ready to accept connections.',
      '                                                                        [string]',
      '',
      'Options:',
      '      --help                    Show help                              [boolean]',
      '      --version                 Show version number                    [boolean]',
      '  -h, --hostname                The hostname to start the server on.',
      '                                                 [string] [default: "localhost"]',
      '  -p, --port                    The port to start the server on.        [number]',
      '  -e, --ephemeral               Whether the server should stop automatically aft',
      '                                er the on-ready command finishes. If no on-ready',
      '                                 command is provided and ephemeral is true, the',
      '                                server will stop immediately after starting.',
      '                                                      [boolean] [default: false]',
      '  -l, --log-unhandled-requests  Whether to log a warning when no interceptors we',
      '                                re found for the base URL of a request. If an in',
      '                                terceptor was matched, the logging behavior for',
      '                                that base URL is configured in the interceptor i',
      '                                tself.                                 [boolean]',
    ].join('\n');

    beforeEach(async () => {
      await filesystem.mkdir(temporarySaveDirectory, { recursive: true });
      await filesystem.rm(temporarySaveFile, { force: true });
    });

    afterEach(async () => {
      await server?.stop();
    });

    it('should show a help message', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--help']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(serverStartHelpOutput);
      });
    });

    it('should start the server on localhost if no hostname is provided', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--port', '5000']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBe(5000);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')}`,
          'Server is running on http://localhost:5000',
        );
      });
    });

    it('should start the server on the provided hostname', async () => {
      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--hostname',
        '0.0.0.0',
        '--port',
        '3000',
      ]);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('0.0.0.0');
        expect(server!.port()).toBe(3000);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(`${chalk.cyan('[zimic]')}`, 'Server is running on http://0.0.0.0:3000');
      });
    });

    it('should start the server on any available port if none is provided', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')}`,
          `Server is running on http://localhost:${server!.port()}`,
        );
      });
    });

    it('should throw an error if the provided port is not an integer, positive number', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--ephemeral', '--port', 'abc']);

      await usingIgnoredConsole(['error'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError(
          'options.port should be >= 0 and < 65536. Received type number (NaN).',
        );

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(
          new RangeError('options.port should be >= 0 and < 65536. Received type number (NaN).'),
        );
      });
    });

    it('should throw an error if the provided port is already in use', async () => {
      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--hostname',
        '0.0.0.0',
        '--port',
        '3000',
      ]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        await runCLI();

        const initialServer = server;

        expect(initialServer).toBeDefined();
        expect(initialServer!.isRunning()).toBe(true);
        expect(initialServer!.hostname()).toBe('0.0.0.0');
        expect(initialServer!.port()).toBe(3000);

        try {
          await expect(runCLI()).rejects.toThrowError('EADDRINUSE: address already in use');

          expect(spies.error).toHaveBeenCalledTimes(1);
          expect(spies.error).toHaveBeenCalledWith(new Error('listen EADDRINUSE: address already in use 0.0.0.0:3000'));
        } finally {
          await initialServer?.stop();
        }
      });
    });

    it('should throw an error if the start timeout is reached', async () => {
      vi.useFakeTimers();

      const delayedListen = delayHttpServerListenIndefinitely();

      try {
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

        await usingIgnoredConsole(['error', 'log'], async (spies) => {
          const cliPromise = runCLI();
          vi.advanceTimersByTime(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);

          const timeoutError = new HttpServerStartTimeoutError(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
          await expect(cliPromise).rejects.toThrowError(timeoutError);

          expect(spies.error).toHaveBeenCalledTimes(1);
          expect(spies.error).toHaveBeenCalledWith(timeoutError);
        });
      } finally {
        delayedListen.mockRestore();
        vi.useRealTimers();
      }
    });

    it('should stop the server after the on-ready command finishes if ephemeral is true', async () => {
      const temporarySaveFileContent = crypto.randomUUID();

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--ephemeral',
        '--',
        'node',
        '-e',
        `require('fs').writeFileSync('${temporarySaveFile}', '${temporarySaveFileContent}')`,
      ]);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(false);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')}`,
          `Ephemeral server is running on http://localhost:${server!.port()}`,
        );

        const savedFile = await filesystem.readFile(temporarySaveFile, 'utf-8');
        expect(savedFile).toBe(temporarySaveFileContent);
      });
    });

    it.each(['--no-ephemeral', '--ephemeral=false'])(
      'should not stop the server after the on-ready command finishes if ephemeral is false: %s',
      async (ephemeralFlag) => {
        const temporarySaveFileContent = crypto.randomUUID();

        processArgvSpy.mockReturnValue([
          'node',
          './dist/cli.js',
          'server',
          'start',
          ephemeralFlag,
          '--',
          'node',
          '-e',
          `require('fs').writeFileSync('${temporarySaveFile}', '${temporarySaveFileContent}')`,
        ]);

        await usingIgnoredConsole(['log'], async (spies) => {
          await runCLI();

          expect(server).toBeDefined();
          expect(server!.isRunning()).toBe(true);
          expect(server!.hostname()).toBe('localhost');
          expect(server!.port()).toBeGreaterThan(0);

          expect(spies.log).toHaveBeenCalledTimes(1);
          expect(spies.log).toHaveBeenCalledWith(
            `${chalk.cyan('[zimic]')}`,
            `Server is running on http://localhost:${server!.port()}`,
          );

          const savedFile = await filesystem.readFile(temporarySaveFile, 'utf-8');
          expect(savedFile).toBe(temporarySaveFileContent);
        });
      },
    );

    it('should throw an error if the stop timeout is reached', async () => {
      vi.useFakeTimers();

      const delayedClose = delayHttpServerCloseIndefinitely({
        onCall() {
          vi.advanceTimersByTime(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
        },
      });

      try {
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--ephemeral']);

        await usingIgnoredConsole(['error', 'log'], async (spies) => {
          const cliPromise = runCLI();

          const timeoutError = new HttpServerStopTimeoutError(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
          await expect(cliPromise).rejects.toThrowError(timeoutError);

          expect(spies.error).toHaveBeenCalledTimes(1);
          expect(spies.error).toHaveBeenCalledWith(timeoutError);
        });
      } finally {
        delayedClose.mockRestore();
        vi.useRealTimers();
      }
    });

    it('should throw an error if the on-ready command executable is not found', async () => {
      const unknownCommand = 'unknown';

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--ephemeral', '--', unknownCommand]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError(`spawn ${unknownCommand} ENOENT`);

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(new Error(`spawn ${unknownCommand} ENOENT`));
      });
    });

    it('should throw an error if the on-ready command fails', async () => {
      const exitCode = 137;

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--ephemeral',
        '--',
        'node',
        '-e',
        `process.exit(${exitCode})`,
      ]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        const error = new CommandError('node', exitCode, null);
        await expect(runCLI()).rejects.toThrowError(error);
        expect(error.message).toBe(`Command 'node' exited with code ${exitCode}.`);

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(error);
      });
    });

    it('should throw an error if the on-ready command is killed by a signal', async () => {
      const signal = 'SIGINT';

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--ephemeral',
        '--',
        'node',
        '-e',
        `process.kill(process.pid, '${signal}')`,
      ]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        const error = new CommandError('node', null, signal);
        await expect(runCLI()).rejects.toThrowError(error);
        expect(error.message).toBe(`Command 'node' exited after signal ${signal}.`);

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(error);
      });
    });

    it.each(PROCESS_EXIT_EVENTS)('should stop the sever after a process exit event: %s', async (exitEvent) => {
      const exitEventListeners = watchExitEventListeners(exitEvent);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')}`,
          `Server is running on http://localhost:${server!.port()}`,
        );

        expect(exitEventListeners).toHaveLength(1);

        for (const listener of exitEventListeners) {
          await listener();
        }

        expect(server!.isRunning()).toBe(false);
      });
    });

    it('should stop the server even if a client is connected', async () => {
      const exitEventListeners = watchExitEventListeners(PROCESS_EXIT_EVENTS[0]);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')}`,
          `Server is running on http://localhost:${server!.port()}`,
        );

        const webSocketClient = new WebSocketClient({
          url: `ws://localhost:${server!.port()}`,
        });

        try {
          await webSocketClient.start();
          expect(webSocketClient.isRunning()).toBe(true);

          expect(exitEventListeners).toHaveLength(1);

          for (const listener of exitEventListeners) {
            await listener();
          }

          expect(server!.isRunning()).toBe(false);
          expect(webSocketClient.isRunning()).toBe(false);
        } finally {
          await webSocketClient.stop();
        }
      });
    });

    it.each([
      { overrideDefault: false as const },
      { overrideDefault: 'static' as const },
      { overrideDefault: 'static-empty' as const },
      { overrideDefault: 'function' as const },
    ])(
      'should show an error if logging is enabled when a request is received and does not match any interceptors: override default $overrideDefault',
      async ({ overrideDefault }) => {
        const exitEventListeners = watchExitEventListeners(PROCESS_EXIT_EVENTS[0]);

        processArgvSpy.mockReturnValue([
          'node',
          './dist/cli.js',
          'server',
          'start',
          ...(overrideDefault === false ? ['--log-unhandled-requests'] : []),
        ]);

        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: true });
        } else if (overrideDefault === 'static-empty') {
          http.default.onUnhandledRequest({});
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(async (_request, context) => {
            await context.log();
          });
        }

        try {
          await usingIgnoredConsole(['log', 'warn', 'error'], async (spies) => {
            await runCLI();

            expect(server).toBeDefined();
            expect(server!.isRunning()).toBe(true);
            expect(server!.hostname()).toBe('localhost');
            expect(server!.port()).toBeGreaterThan(0);

            expect(spies.log).toHaveBeenCalledTimes(1);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            expect(spies.log).toHaveBeenCalledWith(
              `${chalk.cyan('[zimic]')}`,
              `Server is running on http://localhost:${server!.port()}`,
            );

            const request = new Request(`http://localhost:${server!.port()}`, { method: 'GET' });

            const response = fetch(request);
            await expectFetchError(response);

            expect(spies.log).toHaveBeenCalledTimes(1);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(1);

            const errorMessage = spies.error.mock.calls[0].join(' ');
            await verifyUnhandledRequestMessage(errorMessage, {
              type: 'error',
              platform: 'node',
              request,
            });
          });
        } finally {
          for (const listener of exitEventListeners) {
            await listener();
          }
        }
      },
    );

    it.each([{ overrideDefault: false }, { overrideDefault: 'static' }, { overrideDefault: 'function' }])(
      'should not show an error if logging is disabled when a request is received and does not match any interceptors: override default $overrideDefault',
      async ({ overrideDefault }) => {
        const exitEventListeners = watchExitEventListeners(PROCESS_EXIT_EVENTS[0]);
        processArgvSpy.mockReturnValue([
          'node',
          './dist/cli.js',
          'server',
          'start',
          ...(overrideDefault === false ? ['--log-unhandled-requests', 'false'] : []),
        ]);

        if (overrideDefault === 'static') {
          http.default.onUnhandledRequest({ log: false });
        } else if (overrideDefault === 'function') {
          http.default.onUnhandledRequest(vi.fn());
        }

        try {
          await usingIgnoredConsole(['log', 'warn', 'error'], async (spies) => {
            await runCLI();

            expect(server).toBeDefined();
            expect(server!.isRunning()).toBe(true);
            expect(server!.hostname()).toBe('localhost');
            expect(server!.port()).toBeGreaterThan(0);

            expect(spies.log).toHaveBeenCalledTimes(1);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);

            expect(spies.log).toHaveBeenCalledWith(
              `${chalk.cyan('[zimic]')}`,
              `Server is running on http://localhost:${server!.port()}`,
            );

            const request = new Request(`http://localhost:${server!.port()}`, { method: 'GET' });

            const response = fetch(request);
            await expectFetchError(response);

            expect(spies.log).toHaveBeenCalledTimes(1);
            expect(spies.warn).toHaveBeenCalledTimes(0);
            expect(spies.error).toHaveBeenCalledTimes(0);
          });
        } finally {
          for (const listener of exitEventListeners) {
            await listener();
          }
        }
      },
    );

    it('should log an error and reject the request if it could not be handled due to an error', async () => {
      const exitEventListeners = watchExitEventListeners(PROCESS_EXIT_EVENTS[0]);

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--port',
        '5001',
        '--log-unhandled-requests',
      ]);

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: 'http://localhost:5001',
      });

      try {
        await usingIgnoredConsole(['error', 'log'], async (spies) => {
          await runCLI();

          expect(server).toBeDefined();
          expect(server!.isRunning()).toBe(true);
          expect(server!.hostname()).toBe('localhost');
          expect(server!.port()).toBe(5001);

          await interceptor.start();
          await interceptor.get('/users').respond({ status: 204 });

          const error = new Error('An error ocurred.');
          vi.spyOn(WebSocketServer.prototype, 'request').mockRejectedValue(error);

          const request = new Request('http://localhost:5001/users', { method: 'GET' });
          const fetchPromise = fetch(request);
          await expectFetchError(fetchPromise);

          expect(server!.isRunning()).toBe(true);

          expect(spies.error).toHaveBeenCalledTimes(2);
          expect(spies.error.mock.calls[0]).toEqual([error]);

          const errorMessage = spies.error.mock.calls[1].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, {
            type: 'error',
            platform: 'node',
            request,
          });
        });
      } finally {
        await interceptor.stop();

        for (const listener of exitEventListeners) {
          await listener();
        }
      }
    });
  });
});
