import chalk from 'chalk';
import filesystem from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT } from '@/server/constants';
import { PossiblePromise } from '@/types/utils';
import { getCrypto } from '@/utils/crypto';
import { HttpServerStartTimeoutError, HttpServerStopTimeoutError } from '@/utils/http';
import { CommandError, PROCESS_EXIT_EVENTS } from '@/utils/processes';
import WebSocketClient from '@/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';

import runCLI from '../cli';
import { singletonServer as server } from '../server/start';
import { delayHttpServerCloseIndefinitely, delayHttpServerListenIndefinitely } from './utils';

describe('CLI (server)', async () => {
  const crypto = await getCrypto();

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
    'Server',
    '',
    'Commands:',
    '  zimic server start [-- onReady]  Start a mock server.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', '--help']);
    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(serverHelpOutput);
    });
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', 'cli.js', 'server']);

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
      'Start a mock server.',
      '',
      'Positionals:',
      '  onReady  A command to run when the server is ready to accept connections.',
      '                                                                        [string]',
      '',
      'Options:',
      '      --help       Show help                                           [boolean]',
      '      --version    Show version number                                 [boolean]',
      '  -h, --hostname   The hostname to start the server on.',
      '                                                 [string] [default: "localhost"]',
      '  -p, --port       The port to start the server on.                     [number]',
      '  -e, --ephemeral  Whether the server should stop automatically after the on-rea',
      '                   dy command finishes. If no on-ready command is provided and e',
      '                   phemeral is true, the server will stop immediately after star',
      '                   ting.                              [boolean] [default: false]',
    ].join('\n');

    beforeEach(async () => {
      await filesystem.mkdir(temporarySaveDirectory, { recursive: true });
      await filesystem.rm(temporarySaveFile, { force: true });
    });

    afterEach(async () => {
      await server?.stop();
    });

    it('should show a help message', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--help']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(serverStartHelpOutput);
      });
    });

    it('should start the server on localhost if no hostname is provided', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--port', '3000']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBe(3000);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')} Server is running on 'http://localhost:3000'.`,
        );
      });
    });

    it('should start the server on the provided hostname', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--hostname', '0.0.0.0', '--port', '3000']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('0.0.0.0');
        expect(server!.port()).toBe(3000);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(`${chalk.cyan('[zimic]')} Server is running on 'http://0.0.0.0:3000'.`);
      });
    });

    it('should start the server on any available port if none is provided', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')} Server is running on 'http://localhost:${server!.port()}'.`,
        );
      });
    });

    it('should throw an error if the provided port is not an integer, positive number', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--ephemeral', '--port', 'abc']);

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
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--hostname', '0.0.0.0', '--port', '3000']);

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
        processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start']);

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
        'cli.js',
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
          `${chalk.cyan('[zimic]')} Ephemeral server is running on 'http://localhost:${server!.port()}'.`,
        );

        const savedFile = await filesystem.readFile(temporarySaveFile, 'utf-8');
        expect(savedFile).toBe(temporarySaveFileContent);
      });
    });

    it('should not stop the server after the on-ready command finishes if ephemeral is false', async () => {
      const temporarySaveFileContent = crypto.randomUUID();

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'server',
        'start',
        '--ephemeral',
        'false',
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
          `${chalk.cyan('[zimic]')} Server is running on 'http://localhost:${server!.port()}'.`,
        );

        const savedFile = await filesystem.readFile(temporarySaveFile, 'utf-8');
        expect(savedFile).toBe(temporarySaveFileContent);
      });
    });

    it('should throw an error if the stop timeout is reached', async () => {
      vi.useFakeTimers();

      const delayedClose = delayHttpServerCloseIndefinitely({
        onCall() {
          vi.advanceTimersByTime(DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT);
        },
      });

      try {
        processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--ephemeral']);

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

      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start', '--ephemeral', '--', unknownCommand]);

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
        'cli.js',
        'server',
        'start',
        '--ephemeral',
        '--',
        'node',
        '-e',
        `process.exit(${exitCode})`,
      ]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError(`The command 'node' exited with code ${exitCode}.`);

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(new CommandError('node', exitCode, null));
      });
    });

    it('should throw an error if the on-ready command is killed by a signal', async () => {
      const signal = 'SIGINT';

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'server',
        'start',
        '--ephemeral',
        '--',
        'node',
        '-e',
        `process.kill(process.pid, '${signal}')`,
      ]);

      await usingIgnoredConsole(['error', 'log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError(`The command 'node' exited after signal ${signal}.`);

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith(new CommandError('node', null, signal));
      });
    });

    it.each(PROCESS_EXIT_EVENTS)('should stop the sever after a process exit event: %s', async (exitEvent) => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start']);

      const exitEventListeners: (() => PossiblePromise<void>)[] = [];

      vi.spyOn(process, 'on').mockImplementation((event, listener) => {
        if (event === exitEvent) {
          exitEventListeners.push(listener);
        }
        return process;
      });

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')} Server is running on 'http://localhost:${server!.port()}'.`,
        );

        expect(exitEventListeners).toHaveLength(1);

        for (const listener of exitEventListeners) {
          await listener();
        }

        expect(server!.isRunning()).toBe(false);
      });
    });

    it('should stop the server even if a client is connected', async () => {
      const exitEvent = PROCESS_EXIT_EVENTS[0];

      processArgvSpy.mockReturnValue(['node', 'cli.js', 'server', 'start']);

      const exitEventListeners: (() => PossiblePromise<void>)[] = [];

      vi.spyOn(process, 'on').mockImplementation((event, listener) => {
        if (event === exitEvent) {
          exitEventListeners.push(listener);
        }
        return process;
      });

      await usingIgnoredConsole(['log'], async (spies) => {
        await runCLI();

        expect(server).toBeDefined();
        expect(server!.isRunning()).toBe(true);
        expect(server!.hostname()).toBe('localhost');
        expect(server!.port()).toBeGreaterThan(0);

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(
          `${chalk.cyan('[zimic]')} Server is running on 'http://localhost:${server!.port()}'.`,
        );

        expect(exitEventListeners).toHaveLength(1);

        const webSocketClient = new WebSocketClient({
          url: `ws://localhost:${server!.port()}`,
        });

        try {
          await webSocketClient.start();
          expect(webSocketClient.isRunning()).toBe(true);

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
  });
});
