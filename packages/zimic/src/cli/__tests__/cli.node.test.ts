import filesystem from 'fs/promises';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { version } from '@@/package.json';

import { MOCK_SERVICE_WORKER_PATH } from '../browser/init';
import { SERVICE_WORKER_FILE_NAME } from '../browser/shared/constants';
import runCLI from '../cli';

describe('CLI', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  const rootHelpOutput = [
    'zimic <command>',
    '',
    'Commands:',
    '  zimic browser  Browser',
    '  zimic server   Server',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', 'cli.js']);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

    expect(consoleErrorSpy).toHaveBeenCalledWith(rootHelpOutput);
    consoleErrorSpy.mockRestore();
  });

  describe('Version', () => {
    it('should show the CLI version', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', '--version']);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(consoleLogSpy).toHaveBeenCalledWith(version);
      consoleLogSpy.mockRestore();
    });
  });

  describe('Help', () => {
    it('should show a help message', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', '--help']);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(consoleLogSpy).toHaveBeenCalledWith(rootHelpOutput);
      consoleLogSpy.mockRestore();
    });
  });

  describe('Browser', () => {
    const browserHelpOutput = [
      'zimic browser',
      '',
      'Browser',
      '',
      'Commands:',
      '  zimic browser init <publicDirectory>  Initialize the browser service worker.',
      '',
      'Options:',
      '  --help     Show help                                                 [boolean]',
      '  --version  Show version number                                       [boolean]',
    ].join('\n');

    it('should throw an error if no command is provided', async () => {
      processArgvSpy.mockReturnValue(['node', 'cli.js', 'browser']);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(consoleErrorSpy).toHaveBeenCalledWith(browserHelpOutput);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });

    describe('Init', () => {
      const browserInitHelpOutput = [
        'zimic browser init <publicDirectory>',
        '',
        'Initialize the browser service worker.',
        '',
        'Positionals:',
        '  publicDirectory  The path to the public directory of your application.',
        '                                                             [string] [required]',
        '',
        'Options:',
        '  --help     Show help                                                 [boolean]',
        '  --version  Show version number                                       [boolean]',
      ].join('\n');

      it('should copy the service worker file to the provided public directory', async () => {
        const makeDirectorySpy = vi.spyOn(filesystem, 'mkdir').mockImplementation(vi.fn());
        const copyFileSpy = vi.spyOn(filesystem, 'copyFile').mockImplementation(vi.fn());

        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

        const publicDirectory = './public';
        processArgvSpy.mockReturnValue(['node', 'cli.js', 'browser', 'init', publicDirectory]);

        await runCLI();

        const absolutePublicDirectory = path.resolve(publicDirectory);

        expect(makeDirectorySpy).toHaveBeenCalledWith(absolutePublicDirectory, { recursive: true });
        const serviceWorkerDestinationPath = path.join(absolutePublicDirectory, SERVICE_WORKER_FILE_NAME);
        expect(copyFileSpy).toHaveBeenCalledWith(MOCK_SERVICE_WORKER_PATH, serviceWorkerDestinationPath);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(absolutePublicDirectory));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(serviceWorkerDestinationPath));
      });

      it('should throw an error if no public directory is provided', async () => {
        processArgvSpy.mockReturnValue(['node', 'cli.js', 'browser', 'init']);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

        await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

        expect(consoleErrorSpy).toHaveBeenCalledWith(browserInitHelpOutput);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
      });
    });
  });
});
