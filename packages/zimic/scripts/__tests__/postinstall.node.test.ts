import mswPackageJSON from 'msw/package.json';
import { describe, expect, it } from 'vitest';

import postinstall from '../postinstall';

describe('Post-install script', () => {
  it('should remove the default MSW export limitations after installation', async () => {
    await postinstall();

    expect(mswPackageJSON.exports['./browser']).not.toHaveProperty('node');
    expect(mswPackageJSON.exports['./node']).not.toHaveProperty('browser');
    expect(mswPackageJSON.exports['./native']).not.toHaveProperty('browser');
  });
});
