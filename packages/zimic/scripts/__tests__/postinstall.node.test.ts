import mswPackageJSON from 'msw/package.json';
import { describe, expect, it } from 'vitest';

import { postinstallPromise } from '../postinstall';

describe('Post-install script', () => {
  it('should remove the default MSW export limitations after installation', async () => {
    await postinstallPromise;

    const { exports } = mswPackageJSON;

    expect(exports['./browser'].node).toEqual(exports['./node'].node);
    expect(exports['./node'].browser).toEqual(exports['./browser'].browser);
  });
});
