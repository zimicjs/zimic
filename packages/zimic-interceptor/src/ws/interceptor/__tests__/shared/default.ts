import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import InterceptorWebSocketClient from '@/utils/webSocket/WebSocketClient';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

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
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareDefaultWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const store = new WebSocketInterceptorStore();

  let baseURL: string;
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
    // Remote interceptors do not share workers, so only the local worker is stored.
    expect(store.localWorker).toBe(undefined);
  });

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  afterEach(() => {
    expect(store.localWorker).toBe(undefined);
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

      expect(() => {
        createInternalWebSocketInterceptor({
          type: unknownType,  
          baseURL,
        });
      }).toThrow(new UnknownWebSocketInterceptorTypeError(unknownType));
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
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: cycle }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: cycle });
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
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
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

  it('should support starting interceptors concurrently', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (otherInterceptor) => {
        await Promise.all([interceptor.start(), otherInterceptor.start()]);

        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);
      });
    });
  });

  it('should support stopping interceptors concurrently', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, async (otherInterceptor) => {
        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        await Promise.all([interceptor.stop(), otherInterceptor.stop()]);

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(false);
      });
    });
  });

  it('should still stop the worker when the last interceptor fails to stop once and retries', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      const worker = store.localWorker;
      const error = new Error('Unknown error');

      // Stopping normally does not fail. To simulate a failure, we need to mock the stop method to throw an error.
      if (type === 'local') {
        vi.spyOn(LocalWebSocketInterceptorWorker.prototype, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(InterceptorWebSocketClient.prototype, 'stop').mockRejectedValueOnce(error);
      }

      await expect(interceptor.stop()).rejects.toThrow(error);
      expect(interceptor.isRunning).toBe(true);

      await interceptor.stop();

      expect(interceptor.isRunning).toBe(false);
      expect(worker?.isRunning).not.toBe(true);
      expect(store.localWorker).toBeUndefined();

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
    });
  });

  if (type === 'local') {
    // Local interceptors share one worker. Remote interceptors each own a connection to the server.
    it('should start the shared worker when the first interceptor is started', async () => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
        await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (otherInterceptor) => {
          expect(store.localWorker).toBe(undefined);

          await interceptor.start();
          expect(interceptor.isRunning).toBe(true);

          const worker = store.localWorker;
          expect(worker).toBeDefined();
          expect(worker!.isRunning).toBe(true);

          await otherInterceptor.start();
          expect(otherInterceptor.isRunning).toBe(true);

          expect(store.localWorker).toBe(worker);
          expect(worker!.isRunning).toBe(true);
        });
      });
    });

    it('should stop the shared worker when the last interceptor is stopped', async () => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
        await usingWebSocketInterceptor<{}>(interceptorOptions, async (otherInterceptor) => {
          const worker = store.localWorker;
          expect(worker).toBeDefined();
          expect(worker!.isRunning).toBe(true);

          await interceptor.stop();
          expect(interceptor.isRunning).toBe(false);
          expect(worker!.isRunning).toBe(true);

          await otherInterceptor.stop();
          expect(otherInterceptor.isRunning).toBe(false);
          expect(worker!.isRunning).toBe(false);
          expect(store.localWorker).toBe(undefined);
        });
      });
    });

    it('should keep the shared worker running if the last interceptor is stopping at the same time as another is starting', async () => {
      await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
        await usingWebSocketInterceptor<{}>(interceptorOptions, { start: false }, async (otherInterceptor) => {
          const worker = store.localWorker;
          expect(worker).toBeDefined();

          const originalWorkerStop = worker!.stop.bind(worker);
          const { promise: workerStopStartedPromise, resolve: markWorkerStopAsStarted } = Promise.withResolvers<void>();

          // We need to inspect the worker stop method to be able to start another interceptor right after it is called.
          vi.spyOn(worker!, 'stop').mockImplementationOnce(async () => {
            markWorkerStopAsStarted();
            await originalWorkerStop();
          });

          const stopPromise = interceptor.stop();
          await workerStopStartedPromise;
          await otherInterceptor.start();
          await stopPromise;

          expect(interceptor.isRunning).toBe(false);
          expect(otherInterceptor.isRunning).toBe(true);

          expect(store.localWorker).toBe(worker);
          expect(worker!.isRunning).toBe(true);
        });
      });
    });
  }

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

      // No HTTP counterpart: the WebSocket constructor assigns its options through the guarded auth setter.
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

    // Remote-only: handlers are registered with the interceptor server, which local interceptors do not use.
    describe('Registrations', () => {
      it('should register the base URL when a handler is created and resolve it after the registration completes', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          await expectClientToBeRejected();

          await interceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketClient<MessageSchema>(baseURL, (client) => {
            expect(client.readyState).toBe(WebSocketClient.OPEN);
          });
        });
      });

      it('should reset registrations after cleared', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          await interceptor.message().respond({ type: 'server', index: 1 });

          await usingWebSocketClient<MessageSchema>(baseURL, (client) => {
            expect(client.readyState).toBe(WebSocketClient.OPEN);
          });

          await interceptor.clear();
          await expectClientToBeRejected();

          await interceptor.message().respond({ type: 'server', index: 2 });

          await usingWebSocketClient<MessageSchema>(baseURL, (client) => {
            expect(client.readyState).toBe(WebSocketClient.OPEN);
          });
        });
      });

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

      it('should reject a handler if its registration fails and unregister it', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          const registrationError = new Error('Registration failed');

          // No public path makes the server reject a registration, so only the handler commit request is failed.
          const requestSpy = vi
            .spyOn(InterceptorWebSocketClient.prototype, 'request')
            .mockRejectedValueOnce(registrationError);

          try {
            await expect(interceptor.message().respond({ type: 'server', index: 1 }).times(1)).rejects.toBe(
              registrationError,
            );

            expect(requestSpy).toHaveBeenCalledTimes(1);
            expect(requestSpy).toHaveBeenCalledWith('interceptors/ws/workers/commit', expect.anything());
          } finally {
            requestSpy.mockRestore();
          }

          await interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 });

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            // The failed handler matches any message, so it would reply here if it were still registered.
            const unmatchedMessageListener = vi.fn();
            client.addEventListener('message', unmatchedMessageListener);
            client.send(JSON.stringify({ type: 'client', index: 1 }));

            await waitForNot(() => {
              expect(unmatchedMessageListener).toHaveBeenCalled();
            });

            client.removeEventListener('message', unmatchedMessageListener);

            const messagePromise = waitForWebSocketMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 2 }));
            await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
          });

          await expect(interceptor.checkTimes()).resolves.toBeUndefined();
        });
      });

      it('should reply with a later handler to a client after a previous registration failed', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          const registrationError = new Error('Registration failed');

          const requestSpy = vi
            .spyOn(InterceptorWebSocketClient.prototype, 'request')
            .mockRejectedValueOnce(registrationError);

          try {
            await expect(interceptor.message().respond({ type: 'server', index: 1 })).rejects.toBe(registrationError);

            expect(requestSpy).toHaveBeenCalledTimes(1);
            expect(requestSpy).toHaveBeenCalledWith('interceptors/ws/workers/commit', expect.anything());
          } finally {
            requestSpy.mockRestore();
          }

          await interceptor.message().respond({ type: 'server', index: 2 });

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            const messagePromise = waitForWebSocketMessage(client);
            client.send(JSON.stringify({ type: 'client', index: 1 }));
            await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
          });
        });
      });
    });
  }
}
