import { waitFor } from '@zimic/utils/time';
import { expect, it, vi } from 'vitest';

import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '../constants';
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

      handleRequest() {
        return undefined;
      }

      removeHandlersBySocket() {
        return undefined;
      }

      stop() {
        this.stopped = true;
      }
    },
  };
});

it('should discard stale HTTP runtime loads and distinguish initialization failures', async () => {
  const { default: InterceptorServer } = await import('../InterceptorServer');

  const server = new InterceptorServer({ logUnhandledRequests: false });
  const workers: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    await server.start();

    const serverURL = `ws://localhost:${server.port}`;
    const staleWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
    workers.push(staleWorker);

    const staleWorkerStartResult = staleWorker
      .start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: 'http',
        },
        waitForAuthentication: true,
      })
      .catch((error: unknown) => error);

    await waitFor(() => {
      expect(httpRuntimeMock.importStarted).toBe(true);
    });

    const stopPromise = server.stop();
    httpRuntimeMock.releaseImport();
    await stopPromise;
    await staleWorkerStartResult;

    await waitFor(() => {
      expect(
        (server as unknown as { httpRuntimeLoadingPromise?: Promise<unknown> }).httpRuntimeLoadingPromise,
      ).toBeUndefined();
    });
    expect(httpRuntimeMock.instances).toHaveLength(0);
    expect((server as unknown as { httpRuntime?: unknown }).httpRuntime).toBeUndefined();

    await server.start();

    httpRuntimeMock.rejectConstruction = true;
    const failingWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
      url: `ws://localhost:${server.port}`,
    });
    workers.push(failingWorker);

    await expect(
      failingWorker.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: 'http',
        },
        waitForAuthentication: true,
      }),
    ).rejects.toThrow('Could not load the HTTP interceptor runtime. (code 1008)');

    expect((server as unknown as { httpRuntime?: unknown }).httpRuntime).toBeUndefined();

    httpRuntimeMock.rejectConstruction = false;
    const activeWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({
      url: `ws://localhost:${server.port}`,
    });
    workers.push(activeWorker);

    await activeWorker.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: 'http',
      },
      waitForAuthentication: true,
    });

    expect(httpRuntimeMock.instances).toHaveLength(1);
    expect((server as unknown as { httpRuntime?: unknown }).httpRuntime).toBe(httpRuntimeMock.instances[0]);
    expect(consoleError).toHaveBeenCalled();
  } finally {
    await Promise.all(workers.map((worker) => worker.stop()));
    await server.stop();
  }

  expect(httpRuntimeMock.instances[0]?.stopped).toBe(true);
});
