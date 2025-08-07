import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { PROCESS_EXIT_EVENTS } from '@/utils/processes';
import { usingIgnoredConsole } from '@tests/utils/console';

describe('CLI > Server token', () => {
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
    'zimic-interceptor server token',
    '',
    'Manage remote interceptor authentication tokens.',
    '',
    'Commands:',
    '  zimic-interceptor server token create     Create an interceptor token.',
    '  zimic-interceptor server token ls         List the authorized interceptor',
    '                                            tokens.              [aliases: list]',
    '  zimic-interceptor server token rm         Remove (invalidate) an interceptor',
    '  <tokenId>                                 token. Existing connections will not',
    '                                            be affected, so restarting the',
    '                                            server is recommended to disconnect',
    '                                            all interceptors.  [aliases: remove]',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(serverHelpOutput);
    });
  });

  it('should throw an error if no command is provided', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'server', 'token']);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "1"');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Not enough non-option arguments: got 0, need at least 1');
    });
  });
});
