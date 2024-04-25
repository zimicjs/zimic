import { describe } from 'vitest';

import Server from '@/cli/server/Server';
import { getNodeAccessResources } from '@tests/utils/workers';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpRequestTrackerTests({
    platform: 'node',

    async startServer() {
      await server.start();
    },

    getAccessResources(type) {
      return getNodeAccessResources(type, server);
    },

    async stopServer() {
      await server.stop();
    },
  });
});
