import { Override } from '@zimic/utils/types';
import crypto from 'crypto';
import fs from 'fs';
import type mswPackage from 'msw/package.json';
import path from 'path';

export type MSWPackage = typeof mswPackage;
export type MSWExports = MSWPackage['exports'];

export const MSW_ROOT_DIRECTORY = path.join(require.resolve('msw'), '..', '..', '..');
export const MSW_PACKAGE_PATH = path.join(MSW_ROOT_DIRECTORY, 'package.json');

// MSW prevents importing browser resources in node environments and vice versa by using export conditions (null exports).
// This is a problem for @zimic/interceptor because we automatically select the necessary MSW worker/server based on the
// user's environment. Depending on the build system and runtime, export conditions are evaluated before the code is even
// executed, causing preventable build errors. Since @zimic/interceptor already handles the environment detection and
// uses dynamic imports to load the correct MSW entry point, we need to disable MSW's null export conditions by patching
// its package.json after installation.
async function patchMSWExports() {
  const mswPackageContentAsString = await fs.promises.readFile(MSW_PACKAGE_PATH, 'utf-8');
  const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

  const mswExports = mswPackageContent.exports as {
    './browser': Override<MSWExports['./browser'], { node: MSWExports['./node']['node'] | string | null }>;
    './node': Override<MSWExports['./node'], { browser: MSWExports['./browser']['browser'] | string | null }>;
  };

  mswExports['./browser'].node = mswExports['./node'].node;
  mswExports['./node'].browser = mswExports['./browser'].browser;

  // To avoid issues with export condition ordering, the browser export must be defined before the node export.
  const { browser: browserNodeExport, ...nodeExportsWithoutBrowser } = mswExports['./node'];
  mswExports['./node'] = { browser: browserNodeExport, ...nodeExportsWithoutBrowser };

  const patchedMSWPackageContentAsString = JSON.stringify(mswPackageContent, null, 2);
  const temporaryPackagePath = `${MSW_PACKAGE_PATH}.${crypto.randomUUID()}.tmp`;

  // Keep the manifest readable by other processes while the patched exports are written.
  try {
    await fs.promises.writeFile(temporaryPackagePath, patchedMSWPackageContentAsString);
    await fs.promises.rename(temporaryPackagePath, MSW_PACKAGE_PATH);
  } finally {
    await fs.promises.rm(temporaryPackagePath, { force: true });
  }
}

async function postinstall() {
  await patchMSWExports();
}

export const postinstallPromise = postinstall();
