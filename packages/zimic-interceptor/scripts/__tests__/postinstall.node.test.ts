import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { MSW_PACKAGE_PATH, MSW_CORE_DIRECTORY, MSWPackage, postinstallPromise } from '../postinstall';

describe('Post-install script', () => {
  it('should patch msw/package.json exports', async () => {
    await postinstallPromise;

    const mswPackageContentAsString = await fs.promises.readFile(MSW_PACKAGE_PATH, 'utf-8');
    const mswPackageContent = JSON.parse(mswPackageContentAsString) as MSWPackage;

    const { exports } = mswPackageContent;

    expect(exports['./browser'].node).toEqual(exports['./node'].node);
    expect(exports['./node'].browser).toEqual(exports['./browser'].browser);
  });

  it.each(['ws.js', 'ws.mjs'])(
    'should patch the web socket channel to be created lazily in msw/core/%s',
    async (webSocketFileName) => {
      await postinstallPromise;

      const mswWebSocketPath = path.join(MSW_CORE_DIRECTORY, webSocketFileName);
      const mswWebSocketContent = await fs.promises.readFile(mswWebSocketPath, 'utf-8');

      expect(mswWebSocketContent).toContain('let webSocketChannel;');
      expect(mswWebSocketContent).toContain(
        [
          '  if (!webSocketChannel) {',
          '    webSocketChannel = new BroadcastChannel("msw:websocket-client-manager");',
          '    if (isBroadcastChannelWithUnref(webSocketChannel)) {',
          '      webSocketChannel.unref();',
          '    }',
          '  }',
        ].join('\n'),
      );
    },
  );
});
