import { describe, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';

describe('Root entry point', () => {
  it('should log a warning when imported', async () => {
    await usingIgnoredConsole(['warn'], async (spies) => {
      await import('../index');

      expect(spies.warn).toHaveBeenCalledTimes(1);
      expect(spies.warn).toHaveBeenCalledWith(
        [
          'NOTE: The package "zimic" has been renamed to "@zimic/interceptor".',
          'Please replace "zimic" with "@zimic/interceptor" in your package.json.',
        ].join('\n'),
      );
    });
  });
});
