import filesystem from 'fs/promises';
import type mswPackage from 'msw/package.json';
import path from 'path';

import { Override } from '@/types/utils';

type MSWPackage = typeof mswPackage;
type MSWExports = MSWPackage['exports'];

async function patchMSWExports() {
  const mswRootDirectory = path.join(require.resolve('msw'), '..', '..', '..');
  const mswPackagePath = path.join(mswRootDirectory, 'package.json');

  const mswPackageContentAsString = await filesystem.readFile(mswPackagePath, 'utf-8');
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
  await filesystem.writeFile(mswPackagePath, patchedMSWPackageContentAsString);
}

async function postinstall() {
  await patchMSWExports();
}

void postinstall();
