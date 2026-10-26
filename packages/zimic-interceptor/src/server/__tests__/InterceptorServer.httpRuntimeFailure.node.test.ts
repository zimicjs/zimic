import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { version } from '@@/package.json';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';

import type { InterceptorServerWebSocketSchema } from '../types/schema';

const httpRuntimeMock = vi.hoisted(() => {
  function doNothing() {
    return undefined;
  }

  let releaseImport: () => void = doNothing;
  const importGate = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });

  return {
    importGate,
    releaseImport,
    importStarted: false,
    rejectConstruction: false,
    instances: [] as { stopped: boolean }[],
  };
});

vi.mock('../http/HttpInterceptorServerRuntime', async () => {
  httpRuntimeMock.importStarted = true;
  await httpRuntimeMock.importGate;

  return {
    default: class HttpInterceptorServerRuntimeMock {
      stopped = false;

      constructor() {
        if (httpRuntimeMock.rejectConstruction) {
          throw new Error('HTTP runtime construction failed.');
        }

        httpRuntimeMock.instances.push(this);
      }

      handleRequest(_request: unknown, response: { statusCode: number; end: () => void }) {
        response.statusCode = 204;
        response.end();
      }

      removeWorkerBySocket() {
        return undefined;
      }

      stop() {
        this.stopped = true;
      }
    },
  };
});

// The server destroys the connection of a worker whose runtime load became stale, so no close frame is exchanged.
const ABNORMAL_CLOSE_CODE = 1006;

describe('Interceptor server > HTTP runtime failures', () => {
  afterEach(() => {
    httpRuntimeMock.rejectConstruction = false;
    httpRuntimeMock.instances.length = 0;
  });

  it('should discard an HTTP runtime load that was started before the server was stopped', async () => {
    const { default: InterceptorServer } = await import('../InterceptorServer');

    const server = new InterceptorServer({ logUnhandledRequests: false });
    const workers: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];

    await usingIgnoredConsole(['error'], async (console) => {
      try {
        await server.start();

        const staleWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://localhost:${server.port}`,
        });
        workers.push(staleWorker);

        const staleWorkerStartRejection = expect(
          staleWorker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: version,
            },
            waitForAuthentication: true,
          }),
        ).rejects.toHaveProperty('code', ABNORMAL_CLOSE_CODE);

        await waitFor(() => {
          expect(httpRuntimeMock.importStarted).toBe(true);
        });

        const stopPromise = server.stop();
        httpRuntimeMock.releaseImport();
        await stopPromise;

        await staleWorkerStartRejection;
        expect(httpRuntimeMock.instances).toHaveLength(0);

        await server.start();

        await expectFetchError(fetch(`http://localhost:${server.port}/users`));

        const activeWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://localhost:${server.port}`,
        });
        workers.push(activeWorker);

        await activeWorker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: version,
          },
          waitForAuthentication: true,
        });

        const response = await fetch(`http://localhost:${server.port}/users`);
        expect(response.status).toBe(204);
      } finally {
        await Promise.all(workers.map((worker) => worker.stop()));
        await server.stop();
      }

      expect(console.error).not.toHaveBeenCalled();
    });

    expect(httpRuntimeMock.instances).toHaveLength(1);
    expect(httpRuntimeMock.instances[0].stopped).toBe(true);
  });

  it('should reject HTTP workers when the HTTP runtime cannot be constructed and accept them once it can', async () => {
    httpRuntimeMock.releaseImport();

    const { default: InterceptorServer } = await import('../InterceptorServer');

    const server = new InterceptorServer({ logUnhandledRequests: false });
    const workers: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];

    await usingIgnoredConsole(['error'], async (console) => {
      try {
        await server.start();

        httpRuntimeMock.rejectConstruction = true;

        const failingWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://localhost:${server.port}`,
        });
        workers.push(failingWorker);

        await expect(
          failingWorker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: version,
            },
            waitForAuthentication: true,
          }),
        ).rejects.toThrow('Could not load the HTTP interceptor runtime. (code 1008)');

        expect(console.error).toHaveBeenCalled();
        await expectFetchError(fetch(`http://localhost:${server.port}/users`));

        httpRuntimeMock.rejectConstruction = false;

        const activeWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://localhost:${server.port}`,
        });
        workers.push(activeWorker);

        await activeWorker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: version,
          },
          waitForAuthentication: true,
        });

        const response = await fetch(`http://localhost:${server.port}/users`);
        expect(response.status).toBe(204);
      } finally {
        await Promise.all(workers.map((worker) => worker.stop()));
        await server.stop();
      }
    });
  });
});
