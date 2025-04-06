import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROCESS_EXIT_EVENTS } from '@/utils/processes';
import { usingIgnoredConsole } from '@tests/utils/console';

import runCLI from '../../cli';

describe('CLI (server)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  afterEach(() => {
    for (const exitEvent of PROCESS_EXIT_EVENTS) {
      process.removeAllListeners(exitEvent);
    }
  });

  const serverHelpOutput = [
    'zimic-interceptor server',
    '',
    'Manage interceptor servers.',
    '',
    'Commands:',
    '  zimic-interceptor server start  Start an interceptor server.',
    '  zimic-interceptor server token  Manage remote interceptor authentication token',
    '                                  s.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', '--help']);
    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(serverHelpOutput);
    });
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server']);

    await usingIgnoredConsole(['error'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(spies.error).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });
  });
});
