import * as waitForDelayModule from '@zimic/utils/time';
import { beforeAll, afterAll, describe, vi } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDelayWebSocketInterceptorTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, waitForDelay: vi.fn(actualModule.waitForDelay) };
});

describe.each(testMatrix)('WebSocketInterceptor (node, $type) > Delay', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await server.start();
    }
    baseURL = getNodeBaseURL(type, server).replace(/^http/, 'ws');
  });

  afterAll(async () => {
    if (type === 'remote') {
      await server.stop();
    }
  });

  declareDelayWebSocketInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
