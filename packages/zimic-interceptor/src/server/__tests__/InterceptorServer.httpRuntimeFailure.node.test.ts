import { HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import type { InterceptorServerWebSocketSchema } from '../types/schema';

interface HttpRuntimeMock {
  importStarted: ReturnType<typeof createPromiseWithResolvers<void>>;
  importRelease: ReturnType<typeof createPromiseWithResolvers<void>>;
  shouldFailConstruction: boolean;
}

let httpRuntimeMock: HttpRuntimeMock;

// The server destroys the connection of a worker whose runtime load became stale, so no close frame is exchanged.
const ABNORMAL_CLOSE_CODE = 1006;

type Schema = HttpSchema<{
  '/users': { GET: { response: { 204: {} } } };
}>;

describe('Interceptor server > HTTP runtime failures', () => {
  beforeEach(() => {
    const mock: HttpRuntimeMock = {
      importStarted: createPromiseWithResolvers<void>(),
      importRelease: createPromiseWithResolvers<void>(),
      shouldFailConstruction: false,
    };
    httpRuntimeMock = mock;

    // Each test needs a fresh server module and runtime mock, so the cached runtime import runs again behind a new
    // gate. `vi.mock` would keep the first evaluated factory result across `vi.resetModules()`.
    vi.resetModules();

    // No public path delays or fails the dynamic import of the HTTP runtime, so the import is held behind a gate and
    // the real runtime is wrapped by a subclass whose construction fails only while requested.
    vi.doMock('../http/HttpInterceptorServerRuntime', async (importOriginal) => {
      const { default: HttpInterceptorServerRuntime } =
        await importOriginal<typeof import('../http/HttpInterceptorServerRuntime')>();

      mock.importStarted.resolve();
      await mock.importRelease;

      class FailingHttpInterceptorServerRuntime extends HttpInterceptorServerRuntime {
        constructor(...parameters: ConstructorParameters<typeof HttpInterceptorServerRuntime>) {
          if (mock.shouldFailConstruction) {
            throw new Error('HTTP runtime construction failed.');
          }

          super(...parameters);
        }
      }

      return { default: FailingHttpInterceptorServerRuntime };
    });
  });

  it('should discard an HTTP runtime load that was started before the server was stopped', async () => {
    const { default: InterceptorServer } = await import('../InterceptorServer');

    const server = new InterceptorServer({ logUnhandledRequests: false });
    let staleWorker: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;

    await usingIgnoredConsole(['error'], async (console) => {
      try {
        await server.start();

        const baseURL = `http://localhost:${server.port}`;
        staleWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: `ws://localhost:${server.port}` });

        const staleWorkerStartRejection = expect(
          staleWorker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          }),
        ).rejects.toHaveProperty('code', ABNORMAL_CLOSE_CODE);

        await httpRuntimeMock.importStarted;

        const stopPromise = server.stop();
        httpRuntimeMock.importRelease.resolve();
        await stopPromise;

        await staleWorkerStartRejection;

        await server.start();

        await expectFetchError(fetch(`${baseURL}/users`));

        await usingHttpInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
          await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch(`${baseURL}/users`);
          expect(response.status).toBe(204);
        });
      } finally {
        await staleWorker?.stop();
        await server.stop();
      }

      expect(console.error).not.toHaveBeenCalled();
    });
  });

  it('should reject HTTP workers when the HTTP runtime cannot be constructed and accept them once it can', async () => {
    httpRuntimeMock.importRelease.resolve();

    const { default: InterceptorServer } = await import('../InterceptorServer');

    const server = new InterceptorServer({ logUnhandledRequests: false });
    let failingWorker: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;

    await usingIgnoredConsole(['error'], async (console) => {
      try {
        await server.start();

        const baseURL = `http://localhost:${server.port}`;
        failingWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: `ws://localhost:${server.port}` });

        httpRuntimeMock.shouldFailConstruction = true;

        await expect(
          failingWorker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          }),
        ).rejects.toThrow('Could not load the HTTP interceptor runtime. (code 1011)');

        expect(console.error).toHaveBeenCalledOnce();
        expect(console.error).toHaveBeenCalledWith(new Error('HTTP runtime construction failed.'));

        await expectFetchError(fetch(`${baseURL}/users`));

        httpRuntimeMock.shouldFailConstruction = false;

        await usingHttpInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
          await interceptor.get('/users').respond({ status: 204 });

          const response = await fetch(`${baseURL}/users`);
          expect(response.status).toBe(204);
        });
      } finally {
        await failingWorker?.stop();
        await server.stop();
      }
    });
  });
});
