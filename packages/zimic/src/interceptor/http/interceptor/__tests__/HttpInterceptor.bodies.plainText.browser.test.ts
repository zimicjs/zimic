import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declarePlainTextBodyHttpInterceptorTests } from './shared/bodies/plainText';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies > Plain text', async ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  await declarePlainTextBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
