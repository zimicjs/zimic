import { describe, expect } from 'vitest';

import Server from '@/cli/server/Server';
import { getCrypto } from '@/utils/crypto';
import { joinURL } from '@/utils/fetch';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', async () => {
  const server = new Server();

  const crypto = await getCrypto();

  declareSharedHttpInterceptorWorkerTests({
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
