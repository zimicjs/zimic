import { beforeAll, describe } from 'vitest';

import { ExtendedURL } from '@/utils/urls';
import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareBlobBodyHttpInterceptorTests } from './shared/bodies/blob';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptor (browser, $type) > Bodies > Blob', async ({ type }) => {
  let baseURL: ExtendedURL;

  beforeAll(async () => {
    baseURL = await getBrowserBaseURL(type);
  });

  await declareBlobBodyHttpInterceptorTests({
    platform: 'browser',
    type,
    getBaseURL: () => baseURL,
    getInterceptorOptions: () => ({ type, baseURL }),
  });
});
