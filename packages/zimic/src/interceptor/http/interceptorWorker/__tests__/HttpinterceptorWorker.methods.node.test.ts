import { describe } from 'vitest';

import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from './shared/matrix';
import { declareMethodHttpInterceptorWorkerTests } from './shared/methods';

describe.each(testMatrix)('HttpInterceptorWorker methods (node, $type)', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({
    onUnhandledRequest: { action: 'reject', log: false },
  });

  declareMethodHttpInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
