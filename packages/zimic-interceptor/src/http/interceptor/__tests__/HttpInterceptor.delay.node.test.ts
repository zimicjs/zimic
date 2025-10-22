import * as waitForDelayModule from '@zimic/utils/time/waitForDelay';
import { afterAll, beforeAll, describe, vi } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDelayHttpInterceptorTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time/waitForDelay', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, default: vi.fn(actualModule.default) };
});

describe.each(testMatrix)('HttpInterceptor (node, $type) > Delay', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await server.start();
    }
    baseURL = await getNodeBaseURL(type, server);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await server.stop();
    }
  });

  declareDelayHttpInterceptorTests({
    platform: 'node',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
