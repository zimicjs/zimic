import filesystem from 'fs/promises';
import mswPackageJSON from 'msw/package.json';
import path from 'path';

type MSWExports = typeof mswPackageJSON.exports;

const browserExports = mswPackageJSON.exports['./browser'] as Partial<MSWExports['./browser'] & { node: null }>;
const nodeExports = mswPackageJSON.exports['./node'] as Partial<MSWExports['./node'] & { browser: null }>;
const nativeExports = mswPackageJSON.exports['./native'] as Partial<MSWExports['./native'] & { browser: null }>;

const MSW_ROOT_PATH = path.join(require.resolve('msw'), '..', '..', '..');
const MSW_PACKAGE_JSON_PATH = path.join(MSW_ROOT_PATH, 'package.json');

async function patchMSWExportLimitations() {
  delete browserExports.node;
  delete nodeExports.browser;
  delete nativeExports.browser;

  await filesystem.writeFile(MSW_PACKAGE_JSON_PATH, JSON.stringify(mswPackageJSON, null, 2));
}

async function postinstall() {
  await patchMSWExportLimitations();
}

void postinstall();

export default postinstall;
