import filesystem from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { MSW_PACKAGE_PATH, MSW_BROWSER_DIRECTORY, MSWPackage, postinstallPromise } from '../postinstall';

describe('Post-install script', () => {
  it('should patch msw/package.json exports', async () => {
    await postinstallPromise;

    const mswPackageContentAsString = await filesystem.readFile(MSW_PACKAGE_PATH, 'utf-8');
    const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

    const { exports } = mswPackageContent;

    expect(exports['./browser'].node).toEqual(exports['./node'].node);
    expect(exports['./node'].browser).toEqual(exports['./browser'].browser);
  });

  it.each(['index.js', 'index.mjs'])(
    'should patch a missing undefined check in msw/browser/%s',
    async (indexFileName) => {
      await postinstallPromise;

      const mswBrowserPath = path.join(MSW_BROWSER_DIRECTORY, indexFileName);
      const mswBrowserContent = await filesystem.readFile(mswBrowserPath, 'utf-8');

      expect(mswBrowserContent).toContain('if (!request || responseJson.type?.includes("opaque")) {');
    },
  );
});
