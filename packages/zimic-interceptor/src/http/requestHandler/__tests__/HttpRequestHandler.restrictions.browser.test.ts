import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import testMatrix from './shared/matrix';
import { declareRestrictionHttpRequestHandlerTests } from './shared/restrictions';

describe.each(testMatrix)('HttpRequestHandler restrictions (browser, $type)', ({ type, Handler }) => {
  declareRestrictionHttpRequestHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: getBrowserBaseURL,
  });
});
