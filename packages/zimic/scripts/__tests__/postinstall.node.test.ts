import mswPackageJSON from 'msw/package.json';
import { describe, expect, it } from 'vitest';

import postinstall from '../postinstall';

describe('Post-install script', () => {
  it('should remove the default MSW export limitations after installation', async () => {
    await postinstall();

    expect(mswPackageJSON.exports['./browser'].node).toBe(mswPackageJSON.exports['./browser'].default);
    expect(mswPackageJSON.exports['./node'].browser).toBe(mswPackageJSON.exports['./node'].default);
    expect(mswPackageJSON.exports['./native'].browser).toBe(mswPackageJSON.exports['./native'].default);
  });
});
