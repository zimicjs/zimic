import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareMethodHttpInterceptorWorkerTests } from './shared/methods';

describe.each(testMatrix)('HttpInterceptorWorker methods (node, $type)', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareMethodHttpInterceptorWorkerTests({
    platform: 'node',
    type,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
