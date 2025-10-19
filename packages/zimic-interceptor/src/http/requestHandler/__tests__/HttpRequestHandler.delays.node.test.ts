import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareHttpRequestHandlerDelayTests } from './shared/delays';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpRequestHandler delays (node, $type)', ({ type, Handler }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareHttpRequestHandlerDelayTests({
    platform: 'node',
    type,
    Handler,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
