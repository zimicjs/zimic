import path from 'path';
import color from 'picocolors';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import InvalidInterceptorTokenError from '@/server/errors/InvalidInterceptorTokenError';
import {
  createInterceptorTokenId,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  isValidInterceptorTokenId,
  listInterceptorTokens,
} from '@/server/utils/auth';
import { usingIgnoredConsole } from '@tests/utils/console';

import { clearInterceptorTokens } from './utils';

describe('CLI > Server token remove', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const serverStartHelpOutput = [
    'zimic-interceptor server token rm <tokenId>',
    '',
    'Remove (invalidate) an interceptor token. Existing connections will not be',
    'affected, so restarting the server is recommended to disconnect all',
    'interceptors.',
    '',
    'Positionals:',
    '  tokenId  The identifier of the token to remove.            [string] [required]',
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
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(serverStartHelpOutput);
    });
  });

  it('should remove an existing token', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(2);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', tokens[0].id]);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);

      const infoArguments = console.log.mock.calls[0] as string[];
      const infoLines = infoArguments.join(' ').split('\n');

      expect(infoLines).toEqual([
        `${color.cyan('[@zimic/interceptor]')} ${color.green(
          color.bold('✔'),
        )} Token ${color.green(tokens[0].id)} removed.`,
      ]);
    });

    const newTokens = await listInterceptorTokens();
    expect(newTokens).toEqual([tokens[1]]);
  });

  it('should return an error if the token was not found', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);

    const tokenId = createInterceptorTokenId();
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', tokenId]);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(
        1,
        color.cyan('[@zimic/interceptor]'),
        `${color.red(color.bold('✘'))} Token ${color.red(tokenId)} not found.`,
      );
      expect(console.error).toHaveBeenNthCalledWith(2, new Error('process.exit unexpectedly called with "1"'));
    });
  });

  it('should return an error if the token id is invalid', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    await usingIgnoredConsole(['log'], async (console) => {
      await runCLI();

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    const tokens = await listInterceptorTokens();
    expect(tokens).toHaveLength(1);

    const invalidTokenId = 'invalid';
    expect(isValidInterceptorTokenId(invalidTokenId)).toBe(false);

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', invalidTokenId]);

    await usingIgnoredConsole(['error'], async (console) => {
      const error = new InvalidInterceptorTokenError(invalidTokenId);
      await expect(runCLI()).rejects.toThrowError(error);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe('Tokens directory', () => {
    it('should remove an existing token in a custom tokens directory', async () => {
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
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(2);
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: customTokensDirectory });
      expect(tokens).toHaveLength(2);

      processArgvSpy.mockReturnValue([
        'node',
        './dist/cli.js',
        'server',
        'token',
        'rm',
        tokens[0].id,
        '--tokens-dir',
        customTokensDirectory,
      ]);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(
            color.bold('✔'),
          )} Token ${color.green(tokens[0].id)} removed.`,
        ]);
      });

      const newTokens = await listInterceptorTokens({ tokensDirectory: customTokensDirectory });
      expect(newTokens).toEqual([tokens[1]]);
    });

    it('should return an error if the tokens directory was not found', async () => {
      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(0);

      const tokenId = createInterceptorTokenId();
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', tokenId]);

      const error = new Error('process.exit unexpectedly called with "1"');

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(runCLI()).rejects.toThrowError(error);

        expect(console.error).toHaveBeenCalledTimes(2);
        expect(console.error).toHaveBeenNthCalledWith(
          1,
          color.cyan('[@zimic/interceptor]'),
          `${color.red(color.bold('✘'))} Token ${color.red(tokenId)} not found.`,
        );
        expect(console.error).toHaveBeenNthCalledWith(2, error);
      });
    });
  });

  describe('Token name', () => {
    it('should remove a token using the default undefined name', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);
      });

      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(1);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', tokens[0].id]);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(
            color.bold('✔'),
          )} Token ${color.green(tokens[0].id)} removed.`,
        ]);
      });

      const newTokens = await listInterceptorTokens();
      expect(newTokens).toHaveLength(0);
    });

    it('should remove a token using a custom name', async () => {
      const customTokenName = 'my-token';
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', customTokenName]);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);
      });

      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].name).toEqual(customTokenName);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'rm', tokens[0].id]);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(
            color.bold('✔'),
          )} Token ${color.green(tokens[0].name)} removed.`,
        ]);
      });

      const newTokens = await listInterceptorTokens();
      expect(newTokens).toHaveLength(0);
    });
  });

  describe('Aliases', () => {
    it('should have `remove` as a command alias', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(2);
      });

      const tokens = await listInterceptorTokens();
      expect(tokens).toHaveLength(2);

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'remove', tokens[0].id]);

      await usingIgnoredConsole(['log'], async (console) => {
        await runCLI();

        expect(console.log).toHaveBeenCalledTimes(1);

        const infoArguments = console.log.mock.calls[0] as string[];
        const infoLines = infoArguments.join(' ').split('\n');

        expect(infoLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(
            color.bold('✔'),
          )} Token ${color.green(tokens[0].id)} removed.`,
        ]);
      });

      const newTokens = await listInterceptorTokens();
      expect(newTokens).toEqual([tokens[1]]);
    });
  });
});
