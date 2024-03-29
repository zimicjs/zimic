import filesystem from 'fs/promises';
import mswPackageJSON from 'msw/package.json';
import path from 'path';

type MSWExports = typeof mswPackageJSON.exports;

const browserExports = mswPackageJSON.exports['./browser'] as Omit<MSWExports['./browser'], 'node'> & {
  node: string | null;
};

const nodeExports = mswPackageJSON.exports['./node'] as Omit<MSWExports['./node'], 'browser'> & {
  browser: string | null;
};

const nativeExports = mswPackageJSON.exports['./native'] as Omit<MSWExports['./native'], 'browser'> & {
  browser: string | null;
};

const MSW_ROOT_PATH = path.join(require.resolve('msw'), '..', '..', '..');
const MSW_PACKAGE_JSON_PATH = path.join(MSW_ROOT_PATH, 'package.json');

async function patchMSWExportLimitations() {
  browserExports.node = nodeExports.default;
  nodeExports.browser = browserExports.default;
  nativeExports.browser = browserExports.default;

  await filesystem.writeFile(MSW_PACKAGE_JSON_PATH, JSON.stringify(mswPackageJSON, null, 2));
}

async function postinstall() {
  await patchMSWExportLimitations();
}

void postinstall();

export default postinstall;
