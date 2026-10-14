import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import InterceptorWebSocketClient from '@/utils/webSocket/WebSocketClient';
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
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareDefaultWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
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

    describe('Registrations', () => {
      async function expectClientToBeRejected() {
        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(client.readyState).toBe(WebSocketClient.CLOSED);
          });
        });
      }

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

      // No public path makes the server reject a registration, so the commit request is failed once at the transport.
      it('should reject a handler if its registration fails and unregister it', async () => {
        await usingWebSocketInterceptor<MessageSchema>({ type, baseURL }, async (interceptor) => {
          const registrationError = new Error('Registration failed');
          const requestSpy = vi
            .spyOn(InterceptorWebSocketClient.prototype, 'request')
            .mockRejectedValueOnce(registrationError);

          try {
            await expect(interceptor.message().respond({ type: 'server', index: 1 }).times(1)).rejects.toBe(
              registrationError,
            );

            await expect(interceptor.checkTimes()).resolves.toBeUndefined();
          } finally {
            requestSpy.mockRestore();
          }
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
