import filesystem from 'fs/promises';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';

import runCLI from '../../cli';
import { MOCK_SERVICE_WORKER_PATH } from '../init';
import { SERVICE_WORKER_FILE_NAME } from '../shared/constants';

describe('CLI (browser)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  const browserHelpOutput = [
    'zimic browser',
    '',
    'Manage your browser mock configuration',
    '',
    'Commands:',
    '  zimic browser init <publicDirectory>  Initialize the browser service worker co',
    '                                        nfiguration.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', '--help']);
    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(browserHelpOutput);
    });
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser']);

    await usingIgnoredConsole(['error'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(spies.error).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });
  });

  describe('Init', () => {
    const browserInitHelpOutput = [
      'zimic browser init <publicDirectory>',
      '',
      'Initialize the browser service worker configuration.',
      '',
      'Positionals:',
      '  publicDirectory  The path to the public directory of your application.',
      '                                                             [string] [required]',
      '',
      'Options:',
      '  --help     Show help                                                 [boolean]',
      '  --version  Show version number                                       [boolean]',
    ].join('\n');

    it('should show a help message', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', 'init', '--help']);

      await usingIgnoredConsole(['log'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

        expect(spies.log).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledWith(browserInitHelpOutput);
      });
    });

    it('should copy the service worker file to the provided public directory', async () => {
      const makeDirectorySpy = vi.spyOn(filesystem, 'mkdir').mockImplementation(vi.fn());
      const copyFileSpy = vi.spyOn(filesystem, 'copyFile').mockImplementation(vi.fn());

      await usingIgnoredConsole(['log'], async (spies) => {
        const publicDirectory = './public';
        processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', 'init', publicDirectory]);

        await runCLI();

        const absolutePublicDirectory = path.resolve(publicDirectory);

        expect(makeDirectorySpy).toHaveBeenCalledTimes(1);
        expect(makeDirectorySpy).toHaveBeenCalledWith(absolutePublicDirectory, { recursive: true });

        const serviceWorkerDestinationPath = path.join(absolutePublicDirectory, SERVICE_WORKER_FILE_NAME);
        expect(copyFileSpy).toHaveBeenCalledTimes(1);
        expect(copyFileSpy).toHaveBeenCalledWith(MOCK_SERVICE_WORKER_PATH, serviceWorkerDestinationPath);

        expect(spies.log).toHaveBeenCalledTimes(2);
        expect(spies.log).toHaveBeenCalledWith(
          expect.any(String) as string,
          expect.stringContaining(serviceWorkerDestinationPath),
        );
      });
    });

    it('should throw an error if no public directory is provided', async () => {
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', 'init']);

      await usingIgnoredConsole(['error'], async (spies) => {
        await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(spies.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
      });
    });
  });
});
