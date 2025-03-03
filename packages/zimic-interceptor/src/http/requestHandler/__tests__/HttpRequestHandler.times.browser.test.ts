import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareTimesHttpRequestHandlerTests } from './shared/times';

describe.each(testMatrix)('HttpRequestHandler times (browser, $type)', ({ type, Handler }) => {
  declareTimesHttpRequestHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: getBrowserBaseURL,
  });
});
