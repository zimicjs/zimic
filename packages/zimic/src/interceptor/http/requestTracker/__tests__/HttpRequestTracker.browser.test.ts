import { describe } from 'vitest';

import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/fetch';
import { GLOBAL_SETUP_SERVER_HOSTNAME, GLOBAL_SETUP_SERVER_PORT } from '@tests/globalSetup/serverOnBrowser';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (browser)', async () => {
  const crypto = await getCrypto();

  declareSharedHttpRequestTrackerTests({
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
