import { Override } from '@zimic/utils/types';
import fs from 'fs';
import type mswPackage from 'msw/package.json';
import path from 'path';

export type MSWPackage = typeof mswPackage;
export type MSWExports = MSWPackage['exports'];

export const MSW_ROOT_DIRECTORY = path.join(require.resolve('msw'), '..', '..', '..');

export const MSW_PACKAGE_PATH = path.join(MSW_ROOT_DIRECTORY, 'package.json');

export const MSW_CORE_DIRECTORY = path.join(MSW_ROOT_DIRECTORY, 'lib', 'core');
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

// This is a temporary workaround. Once https://github.com/mswjs/msw/issues/2146 is fixed, we should remove it.
async function patchMSWBrowserEntry() {
  for (const indexFileName of ['index.js', 'index.mjs']) {
    const mswBrowserPath = path.join(MSW_BROWSER_DIRECTORY, indexFileName);
    const mswBrowserContent = await fs.promises.readFile(mswBrowserPath, 'utf-8');

    const patchedMSWBrowserContent = mswBrowserContent.replace(
      ['    if (responseJson.type?.includes("opaque")) {', '      return;', '    }'].join('\n'),
      ['    if (!request || responseJson.type?.includes("opaque")) {', '      return;', '    }'].join('\n'),
    );

    await fs.promises.writeFile(mswBrowserPath, patchedMSWBrowserContent);
  }
}

// This is a temporary workaround. Once https://github.com/mswjs/msw/issues/ is fixed, we should remove it.
async function patchMSWWebSocketBroadcastChannel() {
  for (const webSocketFileName of ['ws.js', 'ws.mjs']) {
    const mswWebSocketPath = path.join(MSW_CORE_DIRECTORY, webSocketFileName);
    const mswWebSocketContent = await fs.promises.readFile(mswWebSocketPath, 'utf-8');

    const patchedMSWWebSocketContent = mswWebSocketContent
      .replace(
        [
          'const webSocketChannel = new BroadcastChannel("msw:websocket-client-manager");',
          'if (isBroadcastChannelWithUnref(webSocketChannel)) {',
          '  webSocketChannel.unref();',
          '}',
        ].join('\n'),
        'let webSocketChannel;',
      )
      .replace(
        [
          '  );',
          '  const clientManager = new import_WebSocketClientManager.WebSocketClientManager(webSocketChannel);',
        ].join('\n'),
        [
          '  );',
          '  if (!webSocketChannel) {',
          '    webSocketChannel = new BroadcastChannel("msw:websocket-client-manager");',
          '    if (isBroadcastChannelWithUnref(webSocketChannel)) {',
          '      webSocketChannel.unref();',
          '    }',
          '  }',
          '  const clientManager = new import_WebSocketClientManager.WebSocketClientManager(webSocketChannel);',
        ].join('\n'),
      )
      .replace(
        ['  );', '  const clientManager = new WebSocketClientManager(webSocketChannel);'].join('\n'),
        [
          '  );',
          '  if (!webSocketChannel) {',
          '    webSocketChannel = new BroadcastChannel("msw:websocket-client-manager");',
          '    if (isBroadcastChannelWithUnref(webSocketChannel)) {',
          '      webSocketChannel.unref();',
          '    }',
          '  }',
          '  const clientManager = new WebSocketClientManager(webSocketChannel);',
        ].join('\n'),
      );

    await fs.promises.writeFile(mswWebSocketPath, patchedMSWWebSocketContent);
  }
}

async function postinstall() {
  await Promise.all([patchMSWExports(), patchMSWBrowserEntry(), patchMSWWebSocketBroadcastChannel()]);
}

export const postinstallPromise = postinstall();
