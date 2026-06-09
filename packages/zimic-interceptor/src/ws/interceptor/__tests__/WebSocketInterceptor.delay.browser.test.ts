import * as waitForDelayModule from '@zimic/utils/time';
import { beforeAll, describe, vi } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayWebSocketInterceptorTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, waitForDelay: vi.fn(actualModule.waitForDelay) };
});

describe.each(testMatrix)('WebSocketInterceptor (browser, $type) > Delay', ({ type }) => {
  let baseURL: string;

  beforeAll(() => {
    baseURL = getBrowserBaseURL(type).replace(/^http/, 'ws');
  });

  declareDelayWebSocketInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
