import { describe, expect } from 'vitest';

import Server from '@/cli/server/Server';
import { joinURL } from '@/utils/fetch';

import { declareSharedHttpRequestTrackerTests } from './shared/requestTrackerTests';

describe('HttpRequestTracker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpRequestTrackerTests({
    platform: 'node',

    async startServer() {
      await server.start();
    },

    getBaseURL(type) {
      if (type === 'local') {
        return {
          baseURL: 'http://localhost:3000',
          pathPrefix: '',
        };
      }

      const hostname = server.hostname();
      const port = server.port()!;
      expect(port).not.toBe(null);

      const pathPrefix = `path-${crypto.randomUUID()}`;

      return {
        baseURL: joinURL(`http://${hostname}:${port}`, pathPrefix),
        pathPrefix,
      };
    },

    async stopServer() {
      await server.stop();
    },
  });
});
