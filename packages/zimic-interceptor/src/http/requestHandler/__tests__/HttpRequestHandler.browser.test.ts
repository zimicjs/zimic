import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDefaultHttpRequestHandlerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpRequestHandler (browser, $type)', ({ type, Handler }) => {
  declareDefaultHttpRequestHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: getBrowserBaseURL,
  });
});
