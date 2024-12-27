import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareTimesHttpRequestHandlerTests } from './shared/times';

describe.each(testMatrix)('HttpRequestHandler times (node, $type)', ({ type, Handler }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareTimesHttpRequestHandlerTests({
    platform: 'node',
    type,
    Handler,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
