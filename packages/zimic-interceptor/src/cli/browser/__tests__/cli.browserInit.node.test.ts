import fs from 'fs';
import path from 'path';
import color from 'picocolors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';

import runCLI from '../../cli';
import { MOCK_SERVICE_WORKER_PATH } from '../init';
import { SERVICE_WORKER_FILE_NAME } from '../shared/constants';

describe('CLI > Browser init', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  const browserInitHelpOutput = [
    'zimic-interceptor browser init <publicDirectory>',
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

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(browserInitHelpOutput);
    });
  });

  it('should copy the service worker file to the provided public directory', async () => {
    const makeDirectorySpy = vi.spyOn(fs.promises, 'mkdir').mockImplementation(vi.fn());
    const copyFileSpy = vi.spyOn(fs.promises, 'copyFile').mockImplementation(vi.fn());

    await usingIgnoredConsole(['log'], async (console) => {
      const publicDirectory = './public';
      processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', 'init', publicDirectory]);

      await runCLI();

      expect(makeDirectorySpy).toHaveBeenCalledTimes(1);
      expect(makeDirectorySpy).toHaveBeenCalledWith(publicDirectory, { recursive: true });

      const destinationPath = path.join(publicDirectory, SERVICE_WORKER_FILE_NAME);
      expect(copyFileSpy).toHaveBeenCalledTimes(1);
      expect(copyFileSpy).toHaveBeenCalledWith(MOCK_SERVICE_WORKER_PATH, destinationPath);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        color.cyan('[@zimic/interceptor]'),
        `Service worker script saved to ${color.magenta(destinationPath)}.`,
      );
    });
  });

  it('should throw an error if no public directory is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'browser', 'init']);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });
  });
});
