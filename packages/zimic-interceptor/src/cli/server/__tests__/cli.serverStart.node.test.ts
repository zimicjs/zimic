import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { PROCESS_EXIT_EVENTS, PROCESS_EXIT_CODE_BY_EXIT_EVENT, CommandError } from '@zimic/utils/process';
import { HttpServerStartTimeoutError, HttpServerStopTimeoutError } from '@zimic/utils/server';
import { waitFor, waitForDelay } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import fs from 'fs';
import path from 'path';
import color from 'picocolors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyUnhandledRequestMessage } from '@/http/interceptor/__tests__/shared/utils';
import { createHttpInterceptor } from '@/http/interceptor/factory';
import { DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT } from '@/server/constants';
import { importCrypto } from '@/utils/crypto';
import WebSocketClient from '@/webSocket/WebSocketClient';
import WebSocketServer from '@/webSocket/WebSocketServer';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import runCLI from '../../cli';
import { serverSingleton as server } from '../start';
import { delayHttpServerListenIndefinitely, delayHttpServerCloseIndefinitely } from './utils';

describe('CLI > Server start', async () => {
  const crypto = await importCrypto();

  const processArgvSpy = vi.spyOn(process, 'argv', 'get');
  const processOffSpy = vi.spyOn(process, 'off');
  const processExitSpy = vi.spyOn(process, 'exit').mockReturnValue(undefined as never);

  const temporarySaveDirectory = path.resolve('tmp');
  const temporarySaveFile = path.join(temporarySaveDirectory, 'tmp.txt');

  const serverStartHelpOutput = [
    'zimic-interceptor server start [-- onReady]',
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
    '  -e, --ephemeral               Whether the server should stop automatically',
    '                                after the on-ready command finishes. If no',
    '                                on-ready command is provided and ephemeral is',
    '                                true, the server will stop immediately after',
    '                                starting.             [boolean] [default: false]',
    '  -l, --log-unhandled-requests  Whether to log a warning when no interceptors',
    '                                were found for the base URL of a request. If an',
    '                                interceptor was matched, the logging behavior',
    '                                for that base URL is configured in the',
    '                                interceptor itself.                    [boolean]',
    '  -t, --tokens-dir              The directory where the authorized interceptor',
    '                                authentication tokens are saved. If provided,',
    '                                only remote interceptors bearing a valid token',
    '                                will be accepted. This option is essential if',
    '                                you are exposing your interceptor server',
    '                                publicly. For local development and testing,',
    '                                though, `--tokens-dir` is optional.     [string]',
  ].join('\n');

  function watchExitEventListeners(exitEvent: (typeof PROCESS_EXIT_EVENTS)[number]) {
    const exitEventListeners: (() => PossiblePromise<void>)[] = [];

    vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === exitEvent) {
        exitEventListeners.push(listener as () => void);
      }
      return process;
    });

    return exitEventListeners;
  }

  beforeEach(async () => {
    processArgvSpy.mockReturnValue([]);

    await fs.promises.mkdir(temporarySaveDirectory, { recursive: true });
    await fs.promises.rm(temporarySaveFile, { force: true });
  });

  afterEach(async () => {
    await server?.stop();

    for (const exitEvent of PROCESS_EXIT_EVENTS) {
      process.removeAllListeners(exitEvent);
    }
  });

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(serverStartHelpOutput);
    });
  });

  it('should start the server on localhost if no hostname is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--port', '6500']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBe(6500);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Server is running on ${color.yellow('localhost:6500')}`,
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
      '5000',
    ]);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('0.0.0.0');
      expect(server!.port).toBe(5000);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Server is running on ${color.yellow('0.0.0.0:5000')}`,
      );
    });
  });

  it('should start the server on any available port if none is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBeGreaterThan(0);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
      );
    });
  });

  it('should throw an error if the provided port is not an integer, positive number', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--ephemeral', '--port', 'abc']);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(runCLI()).rejects.toThrowError(
        'options.port should be >= 0 and < 65536. Received type number (NaN).',
      );

      expect(console.error).toHaveBeenCalledTimes(1);

      const errorArguments = console.error.mock.calls[0];

      const error = new RangeError('options.port should be >= 0 and < 65536. Received type number (NaN).');
      expect(errorArguments).toEqual([expect.objectContaining(error)]);

      expect(errorArguments[0]).toHaveProperty('code', 'ERR_SOCKET_BAD_PORT');
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
      '5001',
    ]);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      await runCLI();

      const initialServer = server;

      expect(initialServer).toBeDefined();
      expect(initialServer!.isRunning).toBe(true);
      expect(initialServer!.hostname).toBe('0.0.0.0');
      expect(initialServer!.port).toBe(5001);

      try {
        await expect(runCLI()).rejects.toThrowError('EADDRINUSE: address already in use');

        expect(console.error).toHaveBeenCalledTimes(1);

        const errorArguments = console.error.mock.calls[0];

        const error = new Error('listen EADDRINUSE: address already in use 0.0.0.0:5001');
        expect(errorArguments).toEqual([expect.objectContaining(error)]);

        expect(errorArguments[0]).toHaveProperty('code', 'EADDRINUSE');
        expect(errorArguments[0]).toHaveProperty('errno', -98);
        expect(errorArguments[0]).toHaveProperty('syscall', 'listen');
        expect(errorArguments[0]).toHaveProperty('address', '0.0.0.0');
        expect(errorArguments[0]).toHaveProperty('port', 5001);
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

      await usingIgnoredConsole(['log', 'error'], async (console) => {
        const cliPromise = runCLI();
        vi.advanceTimersByTime(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);

        const timeoutError = new HttpServerStartTimeoutError(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
        await expect(cliPromise).rejects.toThrowError(timeoutError);

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(timeoutError);
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

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(false);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBeGreaterThan(0);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Ephemeral server is running on ${color.yellow(`localhost:${server!.port}`)}`,
      );

      const savedFile = await fs.promises.readFile(temporarySaveFile, 'utf-8');
      expect(savedFile).toBe(temporarySaveFileContent);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(0);

      expect(processOffSpy).toHaveBeenCalledTimes(PROCESS_EXIT_EVENTS.length);
      for (const exitEvent of PROCESS_EXIT_EVENTS) {
        expect(processOffSpy).toHaveBeenCalledWith(exitEvent, expect.any(Function));
      }
    });
  });

  it.each(['--no-ephemeral', '--ephemeral=false'])(
    'should not stop the server after the on-ready command finishes if ephemeral is false (%s)',
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

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe('localhost');
        expect(server!.port).toBeGreaterThan(0);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith(
          color.cyan('[@zimic/interceptor]'),
          `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
        );

        const savedFile = await fs.promises.readFile(temporarySaveFile, 'utf-8');
        expect(savedFile).toBe(temporarySaveFileContent);

        expect(processExitSpy).not.toHaveBeenCalled();
        expect(processOffSpy).toHaveBeenCalledTimes(0);
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

      await usingIgnoredConsole(['log', 'error'], async (console) => {
        const cliPromise = runCLI();

        const timeoutError = new HttpServerStopTimeoutError(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
        await expect(cliPromise).rejects.toThrowError(timeoutError);

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(timeoutError);
      });
    } finally {
      delayedClose.mockRestore();
      vi.useRealTimers();
    }
  });

  it('should throw an error if the on-ready command executable is not found', async () => {
    const unknownCommand = 'unknown';

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--ephemeral', '--', unknownCommand]);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      const spawnError = new Error(`spawn ${unknownCommand} ENOENT`);
      const error = new CommandError(unknownCommand, { cause: spawnError });

      await runCLI();

      // In these tests, the process does not exit after process.exit(), so calling it twice is expected.
      expect(processExitSpy).toHaveBeenCalledTimes(2);
      expect(processExitSpy).toHaveBeenNthCalledWith(1, 1);
      expect(processExitSpy).toHaveBeenNthCalledWith(2, 0);

      expect(console.error).toHaveBeenCalledTimes(1);

      const calledError = console.error.mock.calls[0][0] as CommandError;
      expect(calledError).toBeInstanceOf(CommandError);
      expect(calledError.message).toBe(error.message);
      expect(calledError.command).toEqual(error.command);
      expect(calledError.exitCode).toBe(error.exitCode);
      expect(calledError.cause!.message).toBe(spawnError.message);
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

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      const error = new CommandError('node', {
        command: ['node', '-e', `process.exit(${exitCode})`],
        exitCode,
      });

      await runCLI();

      // In these tests, the process does not exit after process.exit(), so calling it twice is expected.
      expect(processExitSpy).toHaveBeenCalledTimes(2);
      expect(processExitSpy).toHaveBeenNthCalledWith(1, exitCode);
      expect(processExitSpy).toHaveBeenNthCalledWith(2, 0);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  it('should throw an error if the on-ready command is killed by a signal with known exit code', async () => {
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

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      const error = new CommandError('node', {
        command: ['node', '-e', `process.kill(process.pid, '${signal}')`],
        signal,
      });

      await runCLI();

      // In these tests, the process does not exit after process.exit(), so calling it twice is expected.
      expect(processExitSpy).toHaveBeenCalledTimes(2);
      const exitCode = PROCESS_EXIT_CODE_BY_EXIT_EVENT[signal];
      expect(processExitSpy).toHaveBeenNthCalledWith(1, exitCode);
      expect(processExitSpy).toHaveBeenNthCalledWith(2, 0);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  it('should throw an error if the on-ready command is killed by a signal with unknown exit code', async () => {
    const signal = 'SIGKILL';

    const exitCode = PROCESS_EXIT_CODE_BY_EXIT_EVENT[signal];
    expect(exitCode).not.toBeDefined();

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

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      const error = new CommandError('node', {
        command: ['node', '-e', `process.kill(process.pid, '${signal}')`],
        signal,
      });

      await runCLI();

      // In these tests, the process does not exit after process.exit(), so calling it twice is expected.
      expect(processExitSpy).toHaveBeenCalledTimes(2);
      expect(processExitSpy).toHaveBeenNthCalledWith(1, CommandError.DEFAULT_EXIT_CODE);
      expect(processExitSpy).toHaveBeenNthCalledWith(2, 0);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  it.each(PROCESS_EXIT_EVENTS)(
    'should stop the server after a process exit event with the correct exit code (%s)',
    async (exitEvent) => {
      const exitEventListeners = watchExitEventListeners(exitEvent);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe('localhost');
        expect(server!.port).toBeGreaterThan(0);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith(
          color.cyan('[@zimic/interceptor]'),
          `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
        );

        expect(exitEventListeners).toHaveLength(1);

        for (const listener of exitEventListeners) {
          await listener();
        }

        expect(server!.isRunning).toBe(false);

        const exitCode = PROCESS_EXIT_CODE_BY_EXIT_EVENT[exitEvent];
        if (exitCode === undefined) {
          expect(processExitSpy).not.toHaveBeenCalled();
        } else {
          expect(processExitSpy).toHaveBeenCalledTimes(1);
          expect(processExitSpy).toHaveBeenCalledWith(exitCode);
        }

        expect(processOffSpy).toHaveBeenCalledTimes(PROCESS_EXIT_EVENTS.length);
        for (const exitEvent of PROCESS_EXIT_EVENTS) {
          expect(processOffSpy).toHaveBeenCalledWith(exitEvent, expect.any(Function));
        }
      });
    },
  );

  it('should stop the server even if a client is connected', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toBeGreaterThan(0);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
      );

      const webSocketClient = new WebSocketClient({
        url: `ws://localhost:${server!.port}`,
      });

      try {
        await webSocketClient.start();
        expect(webSocketClient.isRunning).toBe(true);

        await server?.stop();

        expect(server!.isRunning).toBe(false);
        expect(webSocketClient.isRunning).toBe(false);
      } finally {
        await webSocketClient.stop();
      }
    });
  });

  it.each([undefined, 'true'])(
    'should show an error if logging is enabled when a request is received and does not match any interceptors (flag %s)',
    async (flagValue) => {
      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        ...(flagValue === undefined ? [] : ['--log-unhandled-requests', flagValue]),
      ]);

      await usingIgnoredConsole(['log', 'warn', 'error'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe('localhost');
        expect(server!.port).toBeGreaterThan(0);
        expect(server!.logUnhandledRequests).toBe(true);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        expect(console.log).toHaveBeenCalledWith(
          color.cyan('[@zimic/interceptor]'),
          `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
        );

        const request = new Request(`http://localhost:${server!.port}`);

        const response = fetch(request);
        await expectFetchError(response);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(1);

        const errorMessage = console.error.mock.calls[0].join(' ');
        await verifyUnhandledRequestMessage(errorMessage, {
          request,
          platform: 'node',
          type: 'reject',
        });
      });
    },
  );

  it.each(['false'])(
    'should not show an error if logging is disabled when a request is received and does not match any interceptors (flag %s)',
    async (flagValue) => {
      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'start',
        '--log-unhandled-requests',
        flagValue,
      ]);

      await usingIgnoredConsole(['log', 'warn', 'error'], async (console) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning).toBe(true);
        expect(server!.hostname).toBe('localhost');
        expect(server!.port).toBeGreaterThan(0);
        expect(server!.logUnhandledRequests).toBe(false);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);

        expect(console.log).toHaveBeenCalledWith(
          color.cyan('[@zimic/interceptor]'),
          `Server is running on ${color.yellow(`localhost:${server!.port}`)}`,
        );

        const request = new Request(`http://localhost:${server!.port}`);

        const response = fetch(request);
        await expectFetchError(response);

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledTimes(0);
        expect(console.error).toHaveBeenCalledTimes(0);
      });
    },
  );

  it('should log an error and reject the request if it could not be handled due to an error', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--log-unhandled-requests']);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toEqual(expect.any(Number));

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
      });

      const webSocketServerRequestSpy = vi.spyOn(WebSocketServer.prototype, 'request');

      try {
        await interceptor.start();
        await interceptor.get('/users').respond({ status: 204 });

        const error = new Error('An error ocurred.');
        webSocketServerRequestSpy.mockRejectedValueOnce(error);

        const request = new Request(`http://localhost:${server!.port}/users`);
        const responsePromise = fetch(request);
        await expectFetchError(responsePromise);

        expect(server!.isRunning).toBe(true);

        expect(console.error).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenNthCalledWith(1, error);

        const errorMessage = console.error.mock.calls[1].join(' ');
        await verifyUnhandledRequestMessage(errorMessage, {
          request,
          platform: 'node',
          type: 'reject',
        });
      } finally {
        webSocketServerRequestSpy.mockRestore();
        await interceptor.stop();
      }
    });
  });

  it('should abort waiting for a worker reply if it was uncommitted before responding', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--log-unhandled-requests']);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toEqual(expect.any(Number));

      await usingHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({ type: 'remote', baseURL: `http://localhost:${server!.port}` }, async (interceptor) => {
        expect(interceptor.isRunning).toBe(true);

        const responseFactoryPromise = createPromiseWithResolvers<{ status: 204 }>();
        const responseFactory = vi.fn(() => responseFactoryPromise);

        await interceptor.get('/users').respond(responseFactory);

        const onFetchError = vi.fn<(error: unknown) => void>();
        const responsePromise = fetch(`http://localhost:${server!.port}/users`).catch(onFetchError);

        await waitFor(() => {
          expect(responseFactory).toHaveBeenCalledTimes(1);
        });

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);

        // Wait for request to fail due to stopped interceptor
        await responsePromise;
        expect(onFetchError).toHaveBeenCalled();

        responseFactoryPromise.resolve({ status: 204 });

        // Wait for slow factory to return the response after the interceptor is already stopped
        await responseFactoryPromise;

        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });

  it('should abort waiting for a worker reply if its internal web socket client was closed before responding', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'start', '--log-unhandled-requests']);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      await runCLI();

      expect(server).toBeDefined();
      expect(server!.isRunning).toBe(true);
      expect(server!.hostname).toBe('localhost');
      expect(server!.port).toEqual(expect.any(Number));

      const interceptor = createHttpInterceptor<{
        '/users': {
          GET: { response: { 204: {} } };
        };
      }>({
        type: 'remote',
        baseURL: `http://localhost:${server!.port}`,
      });

      try {
        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        let wasResponseFactoryCalled = false;

        const responseFactory = vi.fn(async () => {
          wasResponseFactoryCalled = true;

          await waitForDelay(5000);

          /* istanbul ignore next -- @preserve
           * This code is unreachable because the request is aborted before the response is sent. */
          return { status: 204 } as const;
        });

        await interceptor.get('/users').respond(responseFactory);

        const onFetchError = vi.fn<(error: unknown) => void>();
        const responsePromise = fetch(`http://localhost:${server!.port}/users`).catch(onFetchError);

        await waitFor(() => {
          expect(wasResponseFactoryCalled).toBe(true);
        });

        // @ts-expect-error Force the internal web socket client to stop.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await interceptor.client.worker.webSocketClient.stop();

        await responsePromise;

        await waitFor(() => {
          expect(onFetchError).toHaveBeenCalled();
        });

        expect(console.error).not.toHaveBeenCalled();
      } finally {
        await interceptor.stop();
      }
    });
  });
});
