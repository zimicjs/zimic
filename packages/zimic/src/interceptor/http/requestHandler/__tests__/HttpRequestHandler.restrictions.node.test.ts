import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareRestrictionHttpRequestHandlerTests } from './shared/restrictions';

describe.each(testMatrix)('HttpRequestHandler restrictions (Node.js) (type $type)', ({ type, Handler }) => {
  const server = createInternalInterceptorServer();

  declareRestrictionHttpRequestHandlerTests({
    platform: 'node',
    type,
    Handler,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
