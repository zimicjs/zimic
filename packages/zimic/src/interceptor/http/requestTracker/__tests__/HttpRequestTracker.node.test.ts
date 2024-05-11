import { describe } from 'vitest';

import Server from '@/server/Server';
import { getNodeBaseURL } from '@tests/utils/interceptors';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpRequestTrackerTests({
    platform: 'node',

    async startServer() {
      await server.start();
    },

    getBaseURL(type) {
      return getNodeBaseURL(type, server);
    },

    async stopServer() {
      await server.stop();
    },
  });
});
