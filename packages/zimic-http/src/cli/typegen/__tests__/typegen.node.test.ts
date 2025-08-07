import { beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { usingIgnoredConsole } from '@tests/utils/console';

describe('Type generation', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);
  });

  const helpOutput = [
    'zimic-http typegen',
    '',
    'Generate types from schema sources.',
    '',
    'Commands:',
    '  zimic-http typegen openapi <input>  Generate types from an OpenAPI schema.',
    '',
    'Options:',
    '  --help     Show help                                                 [boolean]',
    '  --version  Show version number                                       [boolean]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'typegen', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(helpOutput);
    });
  });
});
