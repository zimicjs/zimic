import { beforeAll, describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareBinaryBodyHttpInterceptorTests } from './shared/bodies/binary';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies > Binary', async ({ type }) => {
  let baseURL: string;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  await declareBinaryBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
