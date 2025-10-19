import { describe } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayHttpRequestHandlerTests } from './shared/delay';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpRequestHandler delay (browser, $type)', ({ type, Handler }) => {
  declareDelayHttpRequestHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type),
  });
});
