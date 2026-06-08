import * as waitForDelayModule from '@zimic/utils/time';
import { describe, vi } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDelayWebSocketMessageHandlerTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, waitForDelay: vi.fn(actualModule.waitForDelay) };
});

describe.each(testMatrix)('WebSocketMessageHandler (node, $type) > Delay', ({ type, Handler }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareDelayWebSocketMessageHandlerTests({
    platform: 'node',
    type,
    Handler,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
