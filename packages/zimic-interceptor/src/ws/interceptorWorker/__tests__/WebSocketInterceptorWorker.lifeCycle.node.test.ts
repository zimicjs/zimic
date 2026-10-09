import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareLifeCycleWebSocketInterceptorWorkerTests } from './shared/lifeCycle';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptorWorker (node, $type) > Life cycle', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareLifeCycleWebSocketInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });
});
