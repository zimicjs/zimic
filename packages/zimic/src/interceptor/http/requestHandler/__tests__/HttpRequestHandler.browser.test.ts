import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpRequestHandlerTests } from './shared/requestHandlerTests';

describe('HttpRequestHandler (browser)', () => {
  declareSharedHttpRequestHandlerTests({
    platform: 'browser',

    getBaseURL(type) {
      return getBrowserBaseURL(type);
    },
  });
});
