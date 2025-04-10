import { Override } from '@zimic/utils/types';
import fs from 'fs';
import type mswPackage from 'msw/package.json';
import path from 'path';

export type MSWPackage = typeof mswPackage;
export type MSWExports = MSWPackage['exports'];

export const MSW_ROOT_DIRECTORY = path.join(require.resolve('msw'), '..', '..', '..');
export const MSW_PACKAGE_PATH = path.join(MSW_ROOT_DIRECTORY, 'package.json');
export const MSW_BROWSER_DIRECTORY = path.join(MSW_ROOT_DIRECTORY, 'lib', 'browser');

async function patchMSWExports() {
  const mswPackageContentAsString = await fs.promises.readFile(MSW_PACKAGE_PATH, 'utf-8');
  const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

  const browserExports = mswPackageContent.exports['./browser'] as Override<
    MSWExports['./browser'],
    { node: MSWExports['./node']['node'] | string | null }
  >;

  const nodeExports = mswPackageContent.exports['./node'] as Override<
    MSWExports['./node'],
    { browser: MSWExports['./browser']['browser'] | string | null }
  >;

  browserExports.node = nodeExports.node;
  nodeExports.browser = browserExports.browser;

  const patchedMSWPackageContentAsString = JSON.stringify(mswPackageContent, null, 2);
  await fs.promises.writeFile(MSW_PACKAGE_PATH, patchedMSWPackageContentAsString);
}

// This is a temporary workaround. Once https://github.com/mswjs/msw/issues/2146 is fixed, we'll be able to remove it.
async function patchMSWBrowserEntry() {
  for (const indexFileName of ['index.js', 'index.mjs']) {
    const mswBrowserPath = path.join(MSW_BROWSER_DIRECTORY, indexFileName);
    const mswBrowserContent = await fs.promises.readFile(mswBrowserPath, 'utf-8');

    const patchedMSWBrowserContent = mswBrowserContent.replace(
      `if (responseJson.type?.includes("opaque")) {
      return;
    }`,

      `if (!request || responseJson.type?.includes("opaque")) {
      return;
    }`,
    );

    await fs.promises.writeFile(mswBrowserPath, patchedMSWBrowserContent);
  }
}

async function postinstall() {
  await patchMSWExports();
  await patchMSWBrowserEntry();
}

export const postinstallPromise = postinstall();
