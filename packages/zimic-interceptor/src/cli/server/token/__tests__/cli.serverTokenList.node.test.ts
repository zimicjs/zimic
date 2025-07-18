import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

import runCLI from '@/cli/cli';
import InvalidInterceptorTokenFileError from '@/server/errors/InvalidInterceptorTokenFileError';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, listInterceptorTokens } from '@/server/utils/auth';
import { usingIgnoredConsole } from '@tests/utils/console';

import { clearInterceptorTokens } from './utils';

describe('CLI > Server token list', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const serverStartHelpOutput = [
    'zimic-interceptor server token ls',
    '',
    'List the authorized interceptor tokens.',
    '',
    'Options:',
    '      --help        Show help                                          [boolean]',
    '      --version     Show version number                                [boolean]',
    '  -t, --tokens-dir  The directory where the interceptor tokens are saved.',
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

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(serverStartHelpOutput);
    });
  });

  it('should list an empty table if no tokens exist', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(0);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);

      const infoArguments = console.log.mock.calls[0] as string[];
      const infoLines = infoArguments.join(' ').split('\n');

      expect(infoLines).toEqual([
        '┌────┬──────┬────────────┐',
        '│ ID │ NAME │ CREATED AT │',
        '├────┼──────┼────────────┤',
        '└────┴──────┴────────────┘',
      ]);
    });
  });

  it('should render an empty name column no tokens have a custom name', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);

      const infoArguments = console.log.mock.calls[0] as string[];
      const infoLines = infoArguments.join(' ').split('\n');

      expect(infoLines).toEqual([
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
    await usingIgnoredConsole(['log'], async (console) => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', 'my-token-1']);
      await runCLI();

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', 'my-token-2']);
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);

      const infoArguments = console.log.mock.calls[0] as string[];
      const infoLines = infoArguments.join(' ').split('\n');

      expect(infoLines).toEqual([
        '┌──────────────────────────────────┬────────────┬──────────────────────────┐',
        '│ ID                               │ NAME       │ CREATED AT               │',
        '├──────────────────────────────────┼────────────┼──────────────────────────┤',
        `│ ${tokens[0].id} │ ${tokens[0].name} │ ${tokens[0].createdAt.toISOString()} │`,
        `│ ${tokens[1].id} │ ${tokens[1].name} │ ${tokens[1].createdAt.toISOString()} │`,
        '└──────────────────────────────────┴────────────┴──────────────────────────┘',
      ]);
    });
  });

  it('should log an error and ignore tokens whose file not valid', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);

    const invalidTokenFileContent = JSON.stringify({});
    const tokenFilePath = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, tokens[0].id);
    await fs.promises.writeFile(tokenFilePath, invalidTokenFileContent);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'ls']);

    await usingIgnoredConsole(['log', 'error'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);

      const infoArguments = console.log.mock.calls[0] as string[];
      const infoLines = infoArguments.join(' ').split('\n');

      expect(infoLines).toEqual([
        '┌──────────────────────────────────┬──────┬──────────────────────────┐',
        '│ ID                               │ NAME │ CREATED AT               │',
        '├──────────────────────────────────┼──────┼──────────────────────────┤',
        `│ ${tokens[1].id} │      │ ${tokens[1].createdAt.toISOString()} │`,
        '└──────────────────────────────────┴──────┴──────────────────────────┘',
      ]);

      expect(console.error).toHaveBeenCalledTimes(1);

      const validationIssues: z.core.$ZodIssue[] = [
        {
          code: 'invalid_value',
          values: [1],
          input: undefined,
          path: ['version'],
          message: 'Invalid input: expected 1',
        },
        {
          expected: 'object',
          code: 'invalid_type',
          input: undefined,
          path: ['token'],
          message: 'Invalid input: expected object, received undefined',
        },
      ];
      const validationErrorMessage = JSON.stringify(validationIssues, null, 2);
      const fileError = new InvalidInterceptorTokenFileError(tokenFilePath, validationErrorMessage);

      expect(console.error).toHaveBeenCalledWith(fileError);
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

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);
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

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
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

      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(0);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
          '┌────┬──────┬────────────┐',
          '│ ID │ NAME │ CREATED AT │',
          '├────┼──────┼────────────┤',
          '└────┴──────┴────────────┘',
        ]);
      });
    });
  });
});
