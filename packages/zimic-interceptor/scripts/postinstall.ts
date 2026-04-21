import { Override } from '@zimic/utils/types';
import fs from 'fs';
import type mswPackage from 'msw/package.json';
import path from 'path';

export type MSWPackage = typeof mswPackage;
export type MSWExports = MSWPackage['exports'];

export const MSW_ROOT_DIRECTORY = path.join(require.resolve('msw'), '..', '..', '..');
export const MSW_PACKAGE_PATH = path.join(MSW_ROOT_DIRECTORY, 'package.json');

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
  await fs.promises.writeFile(MSW_PACKAGE_PATH, patchedMSWPackageContentAsString);
}

async function postinstall() {
  await patchMSWExports();
}

export const postinstallPromise = postinstall();
