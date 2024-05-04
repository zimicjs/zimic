import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createInternalHttpInterceptor, createInternalHttpInterceptorWorker } from '@tests/utils/interceptors';

import { DEFAULT_HTTP_INTERCEPTOR_WORKER_RPC_TIMEOUT } from '../../constants';
import NotStartedHttpInterceptorWorkerError from '../../errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from '../../errors/OtherHttpInterceptorWorkerRunningError';
import UnknownHttpInterceptorWorkerTypeError from '../../errors/UnknownHttpInterceptorWorkerTypeError';
import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker, { SUPPORTED_BASE_URL_PROTOCOLS } from '../../RemoteHttpInterceptorWorker';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerType } from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareDefaultHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, startServer, getAccessResources, stopServer } = options;

  const workerOptionsArray: HttpInterceptorWorkerOptions[] = [
    { type: 'local' },
    { type: 'remote', serverURL: '<temporary>' },
  ];

  describe.each(workerOptionsArray)('Shared (type $type)', (workerOptions) => {
    let worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker | undefined;

    let serverURL: string;
    let baseURL: string;
    let pathPrefix: string;

    function createWorker() {
      return createInternalHttpInterceptorWorker(
        workerOptions.type === 'local' ? workerOptions : { ...workerOptions, serverURL },
      );
    }

    function createDefaultHttpInterceptor(worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker) {
      return createInternalHttpInterceptor<{}>(
        worker instanceof LocalHttpInterceptorWorker ? { worker, baseURL } : { worker, pathPrefix },
      );
    }

    beforeEach(async () => {
      if (workerOptions.type === 'remote') {
        await startServer?.();
      }

      ({
        serverURL,
        clientBaseURL: baseURL,
        clientPathPrefix: pathPrefix,
      } = await getAccessResources(workerOptions.type));
    });

    afterEach(async () => {
      await worker?.stop();

      if (workerOptions.type === 'remote') {
        await stopServer?.();
      }
    });

    it('should initialize using the correct worker and platform', async () => {
      worker = createWorker();

      expect(worker.platform()).toBe(null);
      expect(worker).toBeInstanceOf(HttpInterceptorWorker);
      expect(worker).toBeInstanceOf(
        workerOptions.type === 'remote' ? RemoteHttpInterceptorWorker : LocalHttpInterceptorWorker,
      );

      await worker.start();

      expect(worker.platform()).toBe(platform);

      if (worker instanceof LocalHttpInterceptorWorker) {
        expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
        expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
      }
    });

    it('should not throw an error when started multiple times', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should not throw an error when stopped without running', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should not throw an error when stopped multiple times while running', async () => {
      worker = createWorker();

      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should throw an error if multiple workers are started at the same time', async () => {
      worker = createWorker();
      expect(worker.isRunning()).toBe(false);

      const otherInterceptorWorker = createWorker();
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await worker.start();
      expect(worker.isRunning()).toBe(true);

      await expect(otherInterceptorWorker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
      expect(otherInterceptorWorker.isRunning()).toBe(false);

      await worker.stop();
      expect(worker.isRunning()).toBe(false);

      try {
        await otherInterceptorWorker.start();
        expect(otherInterceptorWorker.isRunning()).toBe(true);

        await expect(worker.start()).rejects.toThrowError(new OtherHttpInterceptorWorkerRunningError());
        expect(worker.isRunning()).toBe(false);
      } finally {
        await otherInterceptorWorker.stop();
      }
    });

    it('should throw an error if initialized with an invalid type', () => {
      // @ts-expect-error Testing invalid type.
      const unknownType: HttpInterceptorWorkerType = 'unknown';

      expect(() => {
        // @ts-expect-error Testing invalid type.
        createInternalHttpInterceptorWorker({ type: unknownType });
      }).toThrowError(new UnknownHttpInterceptorWorkerTypeError(unknownType));
    });

    if (workerOptions.type === 'remote') {
      it('should throw an error if provided an invalid server URL', () => {
        const invalidServerURL = 'invalid';

        expect(() => {
          createInternalHttpInterceptorWorker({ ...workerOptions, serverURL: invalidServerURL });
        }).toThrowError('Invalid URL');
      });

      it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
        'should not throw an error if provided a supported server URL protocol: %s',
        (supportedProtocol) => {
          const url = `${supportedProtocol}://localhost:3000`;

          expect(() => {
            createInternalHttpInterceptorWorker({ ...workerOptions, serverURL: url });
          }).not.toThrowError();
        },
      );

      const exampleUnsupportedProtocols = ['ws', 'wss', 'ftp'];

      it.each(exampleUnsupportedProtocols)(
        'should throw an error if provided an unsupported server URL protocol: %s',
        (unsupportedProtocol) => {
          expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

          const url = `${unsupportedProtocol}://localhost:3000`;

          expect(() => {
            createInternalHttpInterceptorWorker({ ...workerOptions, serverURL: url });
          }).toThrowError(new TypeError(`Expected URL with protocol (http|https), but got '${unsupportedProtocol}'`));
        },
      );

      it('should use a default RPC timeout when not provided', () => {
        worker = createWorker() as RemoteHttpInterceptorWorker;
        expect(worker).toBeInstanceOf(RemoteHttpInterceptorWorker);

        expect(worker.rpcTimeout()).toBe(DEFAULT_HTTP_INTERCEPTOR_WORKER_RPC_TIMEOUT);
      });

      it('should use the provided RPC timeout', () => {
        const rpcTimeout = 1000;

        worker = createInternalHttpInterceptorWorker({
          ...workerOptions,
          serverURL,
          rpcTimeout,
        }) as RemoteHttpInterceptorWorker;
        expect(worker).toBeInstanceOf(RemoteHttpInterceptorWorker);

        expect(worker.rpcTimeout()).toBe(rpcTimeout);
      });
    }

    it('should throw an error if trying to clear handler without a started worker', async () => {
      worker = createWorker();
      expect(worker.isRunning()).toBe(false);

      await expect(async () => {
        await worker?.clearHandlers();
      }).rejects.toThrowError(new NotStartedHttpInterceptorWorkerError());
    });

    it('should throw an error if trying to clear interceptor handlers without a started worker', async () => {
      worker = createWorker();
      expect(worker.isRunning()).toBe(false);

      const interceptor = createDefaultHttpInterceptor(worker);

      await expect(async () => {
        await worker?.clearInterceptorHandlers(interceptor.client());
      }).rejects.toThrowError(new NotStartedHttpInterceptorWorkerError());
    });
  });
}
