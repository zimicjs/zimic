import { describe, expect } from 'vitest';

import Server from '@/cli/server/Server';

import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const server = new Server();

  declareSharedHttpInterceptorWorkerTests({
    platform: 'node',

    async startServer() {
      await server.start();

      const port = server.port()!;
      expect(port).not.toBe(null);

      return {
        hostname: server.hostname(),
        port,
      };
    },

    async stopServer() {
      await server.stop();
    },
  });
});
