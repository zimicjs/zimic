import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declarePathParamsHttpInterceptorWorkerTests } from './shared/pathParams';

describe.each(testMatrix)('HttpInterceptorWorker path params (node, $type)', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declarePathParamsHttpInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
