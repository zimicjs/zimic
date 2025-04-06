import fs from 'fs';
import os from 'os';
import path from 'path';
import color from 'picocolors';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import {
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  INTERCEPTOR_TOKEN_ID_REGEX,
  INTERCEPTOR_TOKEN_SALT_HEX_LENGTH,
  InterceptorTokenFileContent,
  listInterceptorTokens,
  PersistedInterceptorToken,
  INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH,
  INTERCEPTOR_TOKEN_HASH_HEX_LENGTH,
} from '@/server/utils/auth';
import { convertHexLengthToBase64urlLength } from '@/utils/data';
import { pathExists } from '@/utils/files';
import { usingIgnoredConsole } from '@tests/utils/console';

import { clearInterceptorTokens } from './utils';

describe('CLI > Server token create', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const numberOfColorCharactersInTokenValue = 10;
  const expectedTokenBase64urlLength =
    convertHexLengthToBase64urlLength(INTERCEPTOR_TOKEN_VALUE_HEX_LENGTH) + numberOfColorCharactersInTokenValue;

  const serverStartHelpOutput = [
    'zimic-interceptor server token create',
    '',
    'Create an interceptor token.',
    '',
    'Options:',
    '      --help        Show help                                          [boolean]',
    '      --version     Show version number                                [boolean]',
    '  -n, --name        The name of the token to create.                    [string]',
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
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--help']);

    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(serverStartHelpOutput);
    });
  });

  it('should create an interceptor token', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

    let tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    expect(tokensDirectoryExists).toBe(false);

    await usingIgnoredConsole(['info'], async (spies) => {
      await runCLI();

      expect(spies.info).toHaveBeenCalledTimes(1);

      const logArguments = spies.info.mock.calls[0] as string[];
      const logLines = logArguments.join(' ').split('\n');

      expect(logLines).toEqual([
        `${color.cyan('[@zimic/interceptor]')} ${color.green(color.bold('✔'))} Token created:`,
        '',
        expect.stringMatching(new RegExp(`^.{${expectedTokenBase64urlLength}}$`)),
        '',
        'Store this token securely. It cannot be retrieved later.',
        '',
        `To enable authentication in your interceptor server, use the ${color.cyan('--tokens-dir')} option. Only ` +
          'remote interceptors bearing a valid token will be allowed to connect.',
        '',
        `${color.dim('$')} zimic-interceptor server start ${color.cyan(
          '--tokens-dir',
        )} ${color.magenta(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY)}`,
        '',
        'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
      ]);
    });

    tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    expect(tokensDirectoryExists).toBe(true);

    const tokensDirectoryStats = await fs.promises.stat(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    expect(tokensDirectoryStats.mode & 0o777).toBe(0o700);

    const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
    expect(tokens).toHaveLength(1);

    expect(tokens[0]).toEqual<PersistedInterceptorToken>({
      id: expect.stringMatching(INTERCEPTOR_TOKEN_ID_REGEX) as string,
      secret: {
        hash: expect.stringMatching(new RegExp(`^[a-z0-9]{${INTERCEPTOR_TOKEN_HASH_HEX_LENGTH}}$`)) as string,
        salt: expect.stringMatching(new RegExp(`^[a-z0-9]{${INTERCEPTOR_TOKEN_SALT_HEX_LENGTH}}$`)) as string,
      },
      createdAt: expect.any(Date) as Date,
    });

    const filesInTokensDirectory = await fs.promises.readdir(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    expect(filesInTokensDirectory).toHaveLength(2);
    expect(filesInTokensDirectory).toEqual(expect.arrayContaining([tokens[0].id, '.gitignore']));

    const tokenFile = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, tokens[0].id);

    const tokensFileStats = await fs.promises.stat(tokenFile);
    expect(tokensFileStats.mode & 0o777).toBe(0o600);

    const tokenFileContentAsString = await fs.promises.readFile(tokenFile, 'utf-8');
    const tokenFileContent = JSON.parse(tokenFileContentAsString) as InterceptorTokenFileContent.Input;

    expect(tokenFileContent).toEqual<InterceptorTokenFileContent.Input>({
      version: 1,
      token: {
        ...tokens[0],
        createdAt: tokens[0].createdAt.toISOString(),
      },
    });

    const gitignoreFile = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, '.gitignore');
    const gitignoreFileContent = await fs.promises.readFile(gitignoreFile, 'utf-8');
    expect(gitignoreFileContent).toBe(`*${os.EOL}`);
  });

  describe('Tokens directory', () => {
    it('should create an interceptor token using a custom tokens directory', async () => {
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

      let tokensDirectoryExists = await pathExists(customTokensDirectory);
      expect(tokensDirectoryExists).toBe(false);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);

        const logArguments = spies.info.mock.calls[0] as string[];
        const logLines = logArguments.join(' ').split('\n');

        expect(logLines).toContain(
          `${color.dim('$')} zimic-interceptor server start ${color.cyan(
            '--tokens-dir',
          )} ${color.magenta(customTokensDirectory)}`,
        );
      });

      tokensDirectoryExists = await pathExists(customTokensDirectory);
      expect(tokensDirectoryExists).toBe(true);

      const customTokensDirectoryStats = await fs.promises.stat(customTokensDirectory);
      expect(customTokensDirectoryStats.mode & 0o777).toBe(0o700);

      const tokens = await listInterceptorTokens({ tokensDirectory: customTokensDirectory });
      expect(tokens).toHaveLength(1);
    });

    it('should reuse the tokens directory if it already exists', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

      await usingIgnoredConsole(['info'], async (spies) => {
        let tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
        expect(tokensDirectoryExists).toBe(false);

        await runCLI();

        tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
        expect(tokensDirectoryExists).toBe(true);

        await runCLI();

        tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
        expect(tokensDirectoryExists).toBe(true);

        await runCLI();

        tokensDirectoryExists = await pathExists(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
        expect(tokensDirectoryExists).toBe(true);

        expect(spies.info).toHaveBeenCalledTimes(3);
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(3);
    });

    it('should return an error if the tokens directory could not be created', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

      const appendFileError = new Error('Permission denied');
      const appendFileSpy = vi.spyOn(fs.promises, 'appendFile').mockRejectedValue(appendFileError);

      try {
        await usingIgnoredConsole(['error'], async (spies) => {
          await expect(runCLI()).rejects.toThrowError(appendFileError);

          expect(spies.error).toHaveBeenCalledTimes(2);
          expect(spies.error).toHaveBeenNthCalledWith(
            1,
            color.cyan('[@zimic/interceptor]'),
            `${color.red(color.bold('✖'))} Failed to create the tokens directory: ${color.magenta(
              DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
            )}`,
          );
          expect(spies.error).toHaveBeenNthCalledWith(2, appendFileError);
        });
      } finally {
        appendFileSpy.mockRestore();
      }
    });
  });

  describe('Token name', () => {
    it('should create an interceptor token using an undefined name by default', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create']);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);

        const logArguments = spies.info.mock.calls[0] as string[];
        const logLines = logArguments.join(' ').split('\n');

        expect(logLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(color.bold('✔'))} Token created:`,
          '',
          expect.stringMatching(new RegExp(`^.{${expectedTokenBase64urlLength}}$`)),
          '',
          'Store this token securely. It cannot be retrieved later.',
          '',
          `To enable authentication in your interceptor server, use the ${color.cyan('--tokens-dir')} option. Only ` +
            'remote interceptors bearing a valid token will be allowed to connect.',
          '',
          expect.stringMatching('zimic-interceptor server start'),
          '',
          'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
        ]);
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);

      expect(tokens[0].name).toBe(undefined);
    });

    it('should create an interceptor token using a custom name', async () => {
      const customTokenName = 'my-token';

      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', 'create', '--name', customTokenName]);

      await usingIgnoredConsole(['info'], async (spies) => {
        await runCLI();

        expect(spies.info).toHaveBeenCalledTimes(1);

        const logArguments = spies.info.mock.calls[0] as string[];
        const logLines = logArguments.join(' ').split('\n');

        expect(logLines).toEqual([
          `${color.cyan('[@zimic/interceptor]')} ${color.green(color.bold('✔'))} Token ${color.green(customTokenName)} created:`,
          '',
          expect.stringMatching(new RegExp(`^.{${expectedTokenBase64urlLength}}$`)),
          '',
          'Store this token securely. It cannot be retrieved later.',
          '',
          `To enable authentication in your interceptor server, use the ${color.cyan('--tokens-dir')} option. Only ` +
            'remote interceptors bearing a valid token will be allowed to connect.',
          '',
          expect.stringMatching('zimic-interceptor server start'),
          '',
          'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
        ]);
      });

      const tokens = await listInterceptorTokens({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });
      expect(tokens).toHaveLength(1);

      expect(tokens[0].name).toBe(customTokenName);
    });
  });
});
