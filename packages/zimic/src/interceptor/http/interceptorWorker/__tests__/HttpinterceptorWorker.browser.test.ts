import { describe } from 'vitest';

import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', async () => {
  await declareSharedHttpInterceptorWorkerTests({
    platform: 'browser',

    startServer() {
      return {
        hostname: GLOBAL_SETUP_SERVER_HOSTNAME,
        port: GLOBAL_SETUP_SERVER_PORT,
      };
    },
  });
});
