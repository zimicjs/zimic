import fs from 'fs';
import { describe, expect, it } from 'vitest';

import { MSW_PACKAGE_PATH, MSWPackage, postinstallPromise } from '../postinstall';

describe('Post-install script', () => {
  it('should patch msw/package.json exports', async () => {
    await postinstallPromise;

    const mswPackageContentAsString = await fs.promises.readFile(MSW_PACKAGE_PATH, 'utf-8');
    const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

    const { exports } = mswPackageContent;

    expect(exports['./browser'].node).toEqual(exports['./node'].node);
    expect(exports['./node'].browser).toEqual(exports['./browser'].browser);
  });
});
