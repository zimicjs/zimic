import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareHttpRequestHandlerDelayTests } from './shared/delays';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpRequestHandler delays (browser, $type)', ({ type, Handler }) => {
  declareHttpRequestHandlerDelayTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: getBrowserBaseURL,
  });
});
