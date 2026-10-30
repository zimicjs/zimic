import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { ValidationError } from '@zimic/utils/validation';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import InterceptorWebSocketClient from '@/utils/webSocket/WebSocketClient';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorTypeError from '../../errors/UnknownWebSocketInterceptorTypeError';
import { createWebSocketInterceptor } from '../../factory';
import LocalWebSocketInterceptor from '../../LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from '../../RemoteWebSocketInterceptor';
import {
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorOptions,
  WebSocketInterceptorType,
} from '../../types/options';
import {
  LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor,
  RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor,
} from '../../types/public';
import WebSocketInterceptorStore from '../../WebSocketInterceptorStore';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareDefaultWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const store = new WebSocketInterceptorStore();

  let baseURL: string;
  let serverURL: URL;
  let interceptorOptions: WebSocketInterceptorOptions;

  async function expectClientToBeRejected() {
    const client = new WebSocketClient<MessageSchema>(baseURL);

    try {
      // Depending on the platform, a rejected connection either fails to open or closes right after.
      await client.open().catch(() => undefined);

      await waitFor(() => {
        expect(client.readyState).toBe(WebSocketClient.CLOSED);
      });
    } finally {
      await client.close();
    }
  }

  beforeAll(() => {
    serverURL = new URL(getBaseURL());

    const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
    expect(worker).toBe(undefined);
  });

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  afterEach(() => {
    const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
    expect(worker).toBe(undefined);
  });

  describe('Types', () => {
    if (type === 'local') {
      it.each(['local' as const, undefined])('should create a local interceptor (type: %s)', (type) => {
        const interceptor = createWebSocketInterceptor<{}>({ type, baseURL });

        expectTypeOf(interceptor).toEqualTypeOf<PublicLocalWebSocketInterceptor<{}>>();
        expect(interceptor.type).toBe('local');
        expect(interceptor).toBeInstanceOf(LocalWebSocketInterceptor);
      });
    }

    if (type === 'remote') {
      it.each(['remote' as const])('should create a remote interceptor (type: %s)', (type) => {
        const interceptor = createWebSocketInterceptor<{}>({ type, baseURL });

        expectTypeOf(interceptor).toEqualTypeOf<PublicRemoteWebSocketInterceptor<{}>>();
        expect(interceptor.type).toBe('remote');
        expect(interceptor).toBeInstanceOf(RemoteWebSocketInterceptor);
      });
    }

    it('should throw an error if created with an unknown type', () => {
      // @ts-expect-error Forcing an unknown type.
      const unknownType: WebSocketInterceptorType = 'unknown';

      function createUnknownTypeInterceptor() {
        return createInternalWebSocketInterceptor({
          type: unknownType,
          baseURL,
        });
      }

      expect(createUnknownTypeInterceptor).toThrow(new UnknownWebSocketInterceptorTypeError(unknownType));
      expect(createUnknownTypeInterceptor).toThrow(ValidationError);
    });
  });

  it('should initialize with the correct platform', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      expect(interceptor.platform).toBe(null);

      await interceptor.start();
      expect(interceptor.platform).toBe(platform);

      await interceptor.stop();
      expect(interceptor.platform).toBe(null);
    });
  });

  it('should not expose socket members on the interceptor server', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, (interceptor) => {
      expect(interceptor.server).not.toHaveProperty('open' satisfies keyof WebSocketClient<MessageSchema>);
      expect(interceptor.server).not.toHaveProperty('close' satisfies keyof WebSocketClient<MessageSchema>);
      expect(interceptor.server).not.toHaveProperty('readyState' satisfies keyof WebSocketClient<MessageSchema>);
      expect(interceptor.server).not.toHaveProperty('addEventListener' satisfies keyof WebSocketClient<MessageSchema>);
    });
  });

  it('should not throw an error if started multiple times', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
    });
  });

  it('should support starting and stopping the same interceptor concurrently', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await Promise.all([interceptor.start(), interceptor.start()]);
      expect(interceptor.isRunning).toBe(true);

      await Promise.all([interceptor.stop(), interceptor.stop()]);
      expect(interceptor.isRunning).toBe(false);
    });
  });

  it('should intercept messages after repeated stops and restarts', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (interceptor) => {
      for (let cycle = 0; cycle < 5; cycle++) {
        await interceptor.start();
        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: cycle }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: cycle }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: cycle }));
        });

        await interceptor.stop();

        await expectClientToBeRejected();
      }
    });
  });

  it('should support stopping while starting', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    });
  });

  it('should support starting after stopping while starting', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await Promise.all([interceptor.start(), interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    });
  });

  it('should support starting while stopping', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      await Promise.all([interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    });
  });

  it('should intercept messages when another interceptor starts while the last one stops', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (otherInterceptor) => {
        await Promise.all([interceptor.stop(), otherInterceptor.start()]);

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        await promiseIfRemote(otherInterceptor.message().respond({ type: 'server', index: 1 }), otherInterceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
        });
      });
    });
  });

  it('should process lifecycle operations in call order', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      await Promise.all([interceptor.stop(), interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    });
  });

  it('should not throw an error if stopped multiple times', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      expect(interceptor.isRunning).toBe(false);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
      await interceptor.stop();
    });
  });

  it('should start the shared worker when the first interceptor is started', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (otherInterceptor) => {
        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);

        await otherInterceptor.start();
        expect(otherInterceptor.isRunning).toBe(true);

        const sharedWorker =
          type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(sharedWorker).toBe(worker);
        expect(worker!.isRunning).toBe(true);
        expect(worker!.numberOfRunningInterceptors).toBe(2);
      });
    });
  });

  it('should stop the shared worker when the last interceptor is stopped', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, async (otherInterceptor) => {
        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);

        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
        expect(worker!.isRunning).toBe(true);

        await otherInterceptor.stop();
        expect(otherInterceptor.isRunning).toBe(false);
        expect(worker!.isRunning).toBe(false);

        const stoppedWorker =
          type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(stoppedWorker).toBe(undefined);
      });
    });
  });

  it('should share the worker between interceptors with nested base URLs', async () => {
    const nestedBaseURL = `${baseURL}/nested`;

    await usingWebSocketInterceptor<{}>(
      { ...interceptorOptions, baseURL: nestedBaseURL },
      async (nestedInterceptor) => {
        await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
          const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
          expect(worker).toBeDefined();
          expect(worker!.isRunning).toBe(true);
          expect(worker!.numberOfRunningInterceptors).toBe(2);

          await nestedInterceptor.stop();
          expect(nestedInterceptor.isRunning).toBe(false);

          expect(worker!.isRunning).toBe(true);
          expect(worker!.numberOfRunningInterceptors).toBe(1);

          await interceptor.stop();
          expect(interceptor.isRunning).toBe(false);

          expect(worker!.isRunning).toBe(false);

          const stoppedWorker =
            type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
          expect(stoppedWorker).toBe(undefined);
        });
      },
    );
  });

  it('should still stop the shared worker when the last interceptor fails to stop once and retries', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(worker).toBeDefined();
      expect(worker!.isRunning).toBe(true);

      const error = new Error('Unknown error');

      // Stopping normally does not fail. To simulate a failure, we need to mock the stop method to throw an error.
      if (worker instanceof LocalWebSocketInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker!.webSocketClient, 'stop').mockRejectedValueOnce(error);
      }

      await expect(interceptor.stop()).rejects.toThrow(error);
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();

      expect(interceptor.isRunning).toBe(false);
      expect(worker!.isRunning).toBe(false);

      const stoppedWorker =
        type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
      expect(stoppedWorker).toBeUndefined();

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
    });
  });

  it('should support starting interceptors concurrently', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (otherInterceptor) => {
        await Promise.all([interceptor.start(), otherInterceptor.start()]);

        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);
        expect(worker!.numberOfRunningInterceptors).toBe(2);
      });
    });
  });

  it('should support stopping interceptors concurrently', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.isRunning).toBe(true);

        await Promise.all([interceptor.stop(), otherInterceptor.stop()]);

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(false);

        expect(worker!.isRunning).toBe(false);
      });
    });
  });

  it('should keep the shared worker running if the last interceptor is stopping at the same time as another is starting', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (otherInterceptor) => {
        const worker = type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(worker).toBeDefined();
        expect(worker!.numberOfRunningInterceptors).toBe(1);

        const workerStopStartedPromise = createPromiseWithResolvers<void>();
        const workerStopGatePromise = createPromiseWithResolvers<void>();

        // A shutdown dependency is held so that the other interceptor starts while the worker stop is pending.
        if (worker instanceof LocalWebSocketInterceptorWorker) {
          const originalGetMSWWorkerOrCreate = worker.getMSWWorkerOrCreate.bind(worker);

          vi.spyOn(worker, 'getMSWWorkerOrCreate').mockImplementationOnce(async () => {
            workerStopStartedPromise.resolve();
            await workerStopGatePromise;
            return originalGetMSWWorkerOrCreate();
          });
        } else {
          const webSocketClient = worker!.webSocketClient;
          const originalWebSocketClientStop = webSocketClient.stop.bind(webSocketClient);

          vi.spyOn(webSocketClient, 'stop').mockImplementationOnce(async () => {
            workerStopStartedPromise.resolve();
            await workerStopGatePromise;
            return originalWebSocketClientStop();
          });
        }

        const workerStartSpy = vi.spyOn(worker!, 'start');

        const stopPromise = interceptor.stop();
        let startPromise: Promise<void> | undefined;

        try {
          await workerStopStartedPromise;
          startPromise = otherInterceptor.start();

          const startResolutionListener = vi.fn();
          void startPromise.then(startResolutionListener);

          await waitFor(() => {
            expect(workerStartSpy).toHaveBeenCalledTimes(1);
          });
          expect(startResolutionListener).not.toHaveBeenCalled();

          workerStopGatePromise.resolve();
          await Promise.all([stopPromise, startPromise]);
        } finally {
          workerStopGatePromise.resolve();
          await Promise.allSettled([stopPromise, startPromise]);
        }

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        const runningWorker =
          type === 'local' ? store.localWorker : store.getRemoteWorker(serverURL, { auth: undefined });
        expect(runningWorker).toBe(worker);
        expect(worker!.isRunning).toBe(true);

        const reply: MessageSchema = { type: 'server', index: 1 };
        await promiseIfRemote(otherInterceptor.message().respond(reply), otherInterceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 } satisfies MessageSchema));
          await expect(messagePromise).resolves.toBe(JSON.stringify(reply));
        });
      });
    });
  });

  it('should throw an error when trying to be cleared if not running', async () => {
    const interceptor = createInternalWebSocketInterceptor<{}>(interceptorOptions);
    expect(interceptor.isRunning).toBe(false);

    await expect(async () => {
      await interceptor.clear();
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should throw an error when trying to be cleared after stopped', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      await expect(async () => {
        await interceptor.clear();
      }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
    });
  });

  if (type === 'remote') {
    describe('Authentication', () => {
      it('should support changing the authentication options after created', () => {
        const interceptor = createInternalWebSocketInterceptor<{}>({ type, baseURL });
        expect(interceptor.isRunning).toBe(false);

        expect(interceptor.auth).toBe(undefined);

        const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };

        interceptor.auth = auth;
        expect(interceptor.auth).toEqual(auth);

        const otherAuth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'other-token' };
        expect(otherAuth).not.toEqual(auth);

        interceptor.auth.token = otherAuth.token;
        expect(interceptor.auth).toEqual(otherAuth);

        interceptor.auth = undefined;

        expect(interceptor.auth).toBe(undefined);
      });

      it('should not support changing the authentication options while running', async () => {
        await usingWebSocketInterceptor<{}>({ type, baseURL }, async (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          expect(interceptor.auth).toBe(undefined);

          expect(() => {
            interceptor.auth = { token: 'token' };
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toBe(undefined);

          await interceptor.stop();
          expect(interceptor.isRunning).toBe(false);

          const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };

          interceptor.auth = auth;
          expect(interceptor.auth).toEqual(auth);

          await interceptor.start();

          const otherAuth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'other-token' };
          expect(otherAuth).not.toEqual(auth);

          expect(() => {
            interceptor.auth!.token = otherAuth.token;
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual(auth);
        });
      });

      it('should guard constructor-provided authentication options while running', async () => {
        const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };

        await usingWebSocketInterceptor<{}>({ type, baseURL, auth }, (interceptor) => {
          expect(interceptor.isRunning).toBe(true);

          expect(() => {
            interceptor.auth!.token = 'other-token';
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual(auth);
        });
      });
    });

    // Remote-only: local interceptors have no authentication.
    it('should share workers only between interceptors with the same authentication token', async () => {
      const auth = { token: 'token' };
      const otherAuth = { token: 'other-token' };

      await usingWebSocketInterceptor<{}>({ type: 'remote', baseURL, auth }, async () => {
        await usingWebSocketInterceptor<{}>({ type: 'remote', baseURL, auth: { token: auth.token } }, async () => {
          await usingWebSocketInterceptor<{}>({ type: 'remote', baseURL, auth: otherAuth }, () => {
            const worker = store.getRemoteWorker(serverURL, { auth });
            const otherWorker = store.getRemoteWorker(serverURL, { auth: otherAuth });

            expect(worker).toBeDefined();
            expect(otherWorker).toBeDefined();
            expect(otherWorker).not.toBe(worker);

            expect(worker!.numberOfRunningInterceptors).toBe(2);
            expect(otherWorker!.numberOfRunningInterceptors).toBe(1);
          });
        });
      });
    });

    // Remote-only: interceptors are registered with the interceptor server, which local interceptors do not use.
    describe('Registrations', () => {
      it('should reset registrations after stopped', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          await interceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketClient<MessageSchema>(baseURL, (client) => {
            expect(client.readyState).toBe(WebSocketClient.OPEN);
          });

          await interceptor.stop();
          await expectClientToBeRejected();
        });
      });

      it('should not start if its registration fails and support starting again', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, { start: false }, async (interceptor) => {
          const registrationError = new Error('Registration failed');

          // No public path makes the server reject a registration, so only the registration request is failed.
          const requestSpy = vi
            .spyOn(InterceptorWebSocketClient.prototype, 'request')
            .mockRejectedValueOnce(registrationError);

          try {
            await expect(interceptor.start()).rejects.toBe(registrationError);

            expect(requestSpy).toHaveBeenNthCalledWith(1, 'interceptors/ws/workers/reset', expect.anything());
          } finally {
            requestSpy.mockRestore();
          }

          expect(interceptor.isRunning).toBe(false);
          await expectClientToBeRejected();

          await interceptor.start();
          expect(interceptor.isRunning).toBe(true);

          await usingWebSocketClient<MessageSchema>(baseURL, (client) => {
            expect(client.readyState).toBe(WebSocketClient.OPEN);
          });
        });
      });
    });
  }
}
