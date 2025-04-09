import { beforeEach, describe, expect, it, vi } from 'vitest';

import { version } from '@@/package.json';

import { usingIgnoredConsole } from '@tests/utils/console';

import runCLI from '../cli';

describe('CLI', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const rootHelpOutput = [
    'zimic-interceptor [command]',
    '',
    'Commands:',
    '  zimic-interceptor browser  Manage your browser mock configuration.',
    '  zimic-interceptor server   Manage interceptor servers.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  it('should not throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js']);

    await usingIgnoredConsole(['error'], async (console) => {
      await runCLI();

      expect(console.error).toHaveBeenCalledTimes(0);
    });
  });

  it('should throw an error if an unknown command is provided', async () => {
    const unknownCommand = 'unknown';

    processArgvSpy.mockReturnValue(['node', './dist/cli.js', unknownCommand]);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(`Unknown argument: ${unknownCommand}`);
    });
  });

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(rootHelpOutput);
    });
  });

  it('should show the CLI version', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', '--version']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(version);
    });
  });
});
