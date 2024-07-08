import filesystem from 'fs/promises';
import type mswPackage from 'msw/package.json';
import path from 'path';

import { Override } from '@/types/utils';

type MSWPackage = typeof mswPackage;
type MSWExports = MSWPackage['exports'];

async function patchMSWExports() {
  const mswRootPath = path.join(require.resolve('msw'), '..', '..', '..');
  const mswPackagePath = path.join(mswRootPath, 'package.json');

  const mswPackageContentAsString = await filesystem.readFile(mswPackagePath, 'utf-8');
  const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

  const browserExports = mswPackageContent.exports['./browser'] as Override<
    MSWExports['./browser'],
    { node: MSWExports['./browser']['node'] | string | null }
  >;

  const nodeExports = mswPackageContent.exports['./node'] as Override<
    MSWExports['./node'],
    { browser: MSWExports['./browser']['browser'] | string | null }
  >;

  const nativeExports = mswPackageContent.exports['./native'] as Override<
    MSWExports['./native'],
    { browser: MSWExports['./native']['browser'] | string | null }
  >;

  browserExports.node = nodeExports.default;
  nodeExports.browser = browserExports.default;
  nativeExports.browser = browserExports.default;

  await filesystem.writeFile(mswPackagePath, JSON.stringify(mswPackageContent, null, 2));
}

async function postinstall() {
  await patchMSWExports();
}

void postinstall();

export default postinstall;
