import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpRequestHandlerTests } from './shared';

describe('HttpRequestHandler (browser)', () => {
  declareSharedHttpRequestHandlerTests({
    platform: 'browser',

    getBaseURL(type) {
      return getBrowserBaseURL(type);
    },
  });
});
