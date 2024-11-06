import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { declareDefaultHttpInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('HttpInterceptorWorker (node, $type)', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({
    onUnhandledRequest: { action: 'reject', log: false },
  });

  declareDefaultHttpInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
