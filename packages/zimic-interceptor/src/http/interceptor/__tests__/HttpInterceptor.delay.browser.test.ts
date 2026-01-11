import * as waitForDelayModule from '@zimic/utils/time';
import { beforeAll, describe, vi } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayHttpInterceptorTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, waitForDelay: vi.fn(actualModule.waitForDelay) };
});

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Delay', ({ type }) => {
  let baseURL: string;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  declareDelayHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
