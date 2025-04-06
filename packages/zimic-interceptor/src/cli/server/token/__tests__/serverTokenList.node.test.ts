import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, listInterceptorTokens } from '@/server/utils/auth';
import { usingIgnoredConsole } from '@tests/utils/console';

import { clearInterceptorTokens } from './utils';

describe('CLI > Server token list', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const serverStartHelpOutput = [
    'zimic-interceptor server token ls',
    '',
    'List interceptor tokens.',
    '',
    'Options:',
    '      --help        Show help                                          [boolean]',
    '      --version     Show version number                                [boolean]',
    '  -t, --tokens-dir  The path to the directory where the tokens are stored.',
    `                         [string] [default: "${DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY}"]`,
  ].join('\n');

  beforeEach(async () => {
    processArgvSpy.mockReturnValue([]);

    await clearInterceptorTokens();
  });

  afterAll(async () => {
    await clearInterceptorTokens();
  });

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls', '--help']);

    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(serverStartHelpOutput);
    });
  });

  it('should list an empty table if no tokens exist', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
    expect(tokens).toHaveLength(0);

    await usingIgnoredConsole(['info'], async (spies) => {
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(1);

      const logArguments = spies.info.mock.calls[0] as string[];
      const logLines = logArguments.join(' ').split('\n');

      expect(logLines).toEqual([
        '┌────┬──────┬────────────┐',
        '│ ID │ NAME │ CREATED AT │',
        '├────┼──────┼────────────┤',
        '└────┴──────┴────────────┘',
      ]);
    });
  });

  it('should render an empty name column no tokens have a custom name', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['info'], async (spies) => {
      await runCLI();
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
    expect(tokens).toHaveLength(2);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    await usingIgnoredConsole(['info'], async (spies) => {
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(1);

      const logArguments = spies.info.mock.calls[0] as string[];
      const logLines = logArguments.join(' ').split('\n');

      expect(logLines).toEqual([
        '┌──────────────────────────────────┬──────┬──────────────────────────┐',
        '│ ID                               │ NAME │ CREATED AT               │',
        '├──────────────────────────────────┼──────┼──────────────────────────┤',
        `│ ${tokens[0].id} │      │ ${tokens[0].createdAt.toISOString()} │`,
        `│ ${tokens[1].id} │      │ ${tokens[1].createdAt.toISOString()} │`,
        '└──────────────────────────────────┴──────┴──────────────────────────┘',
      ]);
    });
  });

  it('should render tokens with a custom name', async () => {
    await usingIgnoredConsole(['info'], async (spies) => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', 'my-token-1']);
      await runCLI();

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', 'my-token-2']);
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
    expect(tokens).toHaveLength(2);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    await usingIgnoredConsole(['info'], async (spies) => {
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(1);

      const logArguments = spies.info.mock.calls[0] as string[];
      const logLines = logArguments.join(' ').split('\n');

      expect(logLines).toEqual([
        '┌──────────────────────────────────┬────────────┬──────────────────────────┐',
        '│ ID                               │ NAME       │ CREATED AT               │',
        '├──────────────────────────────────┼────────────┼──────────────────────────┤',
        `│ ${tokens[0].id} │ ${tokens[0].name} │ ${tokens[0].createdAt.toISOString()} │`,
        `│ ${tokens[1].id} │ ${tokens[1].name} │ ${tokens[1].createdAt.toISOString()} │`,
        '└──────────────────────────────────┴────────────┴──────────────────────────┘',
      ]);
    });
  });

  describe('Tokens directory', () => {
    it('should list the tokens in a custom tokens directory', async () => {
      const customTokensDirectory = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, 'custom');

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'token',
        'create',
        '--tokens-dir',
        customTokensDirectory,
      ]);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: customTokensDirectory });
      expect(tokens).toHaveLength(1);

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'token',
        'ls',
        '--tokens-dir',
        customTokensDirectory,
      ]);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);

        const logArguments = spies.info.mock.calls[0] as string[];
        const logLines = logArguments.join(' ').split('\n');

        expect(logLines).toEqual([
          '┌──────────────────────────────────┬──────┬──────────────────────────┐',
          '│ ID                               │ NAME │ CREATED AT               │',
          '├──────────────────────────────────┼──────┼──────────────────────────┤',
          `│ ${tokens[0].id} │      │ ${tokens[0].createdAt.toISOString()} │`,
          '└──────────────────────────────────┴──────┴──────────────────────────┘',
        ]);
      });
    });
  });

  describe('Aliases', () => {
    it('should have `list` as a command alias', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'list']);

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(0);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);

        const logArguments = spies.info.mock.calls[0] as string[];
        const logLines = logArguments.join(' ').split('\n');

        expect(logLines).toEqual([
          '┌────┬──────┬────────────┐',
          '│ ID │ NAME │ CREATED AT │',
          '├────┼──────┼────────────┤',
          '└────┴──────┴────────────┘',
        ]);
      });
    });
  });
});
