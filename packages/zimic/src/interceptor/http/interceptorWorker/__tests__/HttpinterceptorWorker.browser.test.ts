import { describe } from 'vitest';

import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/fetch';
import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', async () => {
  const crypto = await getCrypto();

  declareSharedHttpInterceptorWorkerTests({
    platform: 'browser',

    getBaseURL(type) {
      if (type === 'local') {
        return {
          baseURL: 'http://localhost:3000',
          pathPrefix: '',
        };
      }

      const pathPrefix = `path-${crypto.randomUUID()}`;

      return {
        baseURL: joinURL(`http://${GLOBAL_SETUP_SERVER_HOSTNAME}:${GLOBAL_SETUP_SERVER_PORT}`, pathPrefix),
        pathPrefix,
      };
    },
  });
});
