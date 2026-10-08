import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';
import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorOptions } from '../../types/options';
import { WebSocketInterceptorConnectionListener } from '../../types/public';
import WebSocketInterceptorImplementation from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;
  let closeClients: (() => Promise<void>)[];

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
    closeClients = [];
  });

  afterEach(async () => {
    await Promise.all(closeClients.map((closeClient) => closeClient()));
  });

  it('should stop when called while starting', async () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>({ type, baseURL });

    try {
      await Promise.all([interceptor.start(), interceptor.stop()]);

      expect(interceptor.isRunning).toBe(false);
      expect(interceptor.platform).toBe(null);
    } finally {
      await interceptor.stop();
    }
  });

  it('should start when called after stopping while starting', async () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>({ type, baseURL });

    try {
      await Promise.all([interceptor.start(), interceptor.stop(), interceptor.start()]);

      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(platform);
    } finally {
      await interceptor.stop();
    }
  });

  it('should initialize with the correct platform', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.platform).toBe(null);

    await interceptor.start();
    expect(interceptor.platform).toBe(platform);

    await interceptor.stop();
    expect(interceptor.platform).toBe(null);
  });

  it('should not throw if started or stopped multiple times', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);

    await interceptor.start();
    await interceptor.start();

    expect(interceptor.isRunning).toBe(true);

    await interceptor.stop();
    await interceptor.stop();

    expect(interceptor.isRunning).toBe(false);
  });

  it('should support updating message saving options', () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    interceptor.messageSaving = { enabled: false, safeLimit: 10 };

    expect(interceptor.messageSaving).toEqual({ enabled: false, safeLimit: 10 });
  });

  it('should handle messages without an explicit sender or receiver context', async () => {
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL(baseURL),
      messageSaving: { enabled: true },
      Handler: LocalWebSocketMessageHandler,
    });

    try {
      await interceptor.start();

      const effect = vi.fn();
      const handler = interceptor.message().with({ type: 'client' }).effect(effect).times(1);

      const wasHandled = await interceptor.handleInterceptedMessage(JSON.stringify({ type: 'client', index: 1 }));

      expect(wasHandled).toBe(true);
      expect(effect).toHaveBeenCalledTimes(1);
      expect(handler.messages).toHaveLength(1);
      expect(handler.messages[0].sender.url).toBe(interceptor.baseURLAsString);
      expect(handler.messages[0].receiver).toBe(interceptor.server);

      interceptor.checkTimes();
    } finally {
      await interceptor.stop();
    }
  });

  it('should use the injected transport for interceptor clients', () => {
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL(baseURL),
      Handler: LocalWebSocketMessageHandler,
    });
    const rawSend = JSON.stringify({ type: 'client' as const, index: 1 }) as WebSocketMessageData<MessageSchema>;
    const send = vi.fn();
    const client = interceptor.createClient(baseURL, { send });

    client.send(rawSend);

    expect(send).toHaveBeenCalledWith(rawSend);
  });

  async function createClient(options: { timeout?: number } = {}) {
    const client = new WebSocketClient<MessageSchema>(baseURL);
    closeClients.push(() => client.close());

    await client.open({ timeout: options.timeout });

    return client;
  }

  async function expectClientToCloseAsUnhandled() {
    const client = new WebSocketClient<MessageSchema>(baseURL);
    closeClients.push(() => client.close());

    const closeEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
      client.addEventListener('close', resolve, { once: true });
    });

    await client.open({ timeout: 500 });

    const closeEvent = await closeEventPromise;
    expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  }

  describe('Connection listeners', () => {
    it('should deliver the connected client once per connection', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const listener = vi.fn<WebSocketInterceptorConnectionListener<MessageSchema>>();
        const effect = vi.fn();
        interceptor.on('connection', listener);
        await promiseIfRemote(interceptor.message().effect(effect), interceptor);

        const firstClient = await createClient();
        await waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(1);
        });
        const firstInterceptorClient = listener.mock.calls[0][0];
        expect(firstInterceptorClient).toBe(interceptor.clients[0]);
        expect(firstInterceptorClient.url).toBe(firstClient.url);

        firstClient.send(JSON.stringify({ type: 'client', index: 1 }));
        firstClient.send(JSON.stringify({ type: 'client', index: 2 }));
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(2);
        });
        expect(listener).toHaveBeenCalledTimes(1);

        await createClient();
        await waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(2);
        });
        expect(listener.mock.calls[1][0]).toBe(interceptor.clients[1]);
        expect(listener.mock.calls[1][0]).not.toBe(firstInterceptorClient);
      });
    });

    it.each(['on', 'once'] as const)('should remove listeners registered with %s', async (method) => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const listener = vi.fn();
        const retainedListener = vi.fn();
        interceptor[method]('connection', listener);
        interceptor.on('connection', retainedListener);
        interceptor.off('connection', listener);
        await promiseIfRemote(interceptor.message(), interceptor);

        await createClient();
        await waitFor(() => {
          expect(retainedListener).toHaveBeenCalledTimes(1);
        });
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it('should retain connection listeners across clear, stop, and restart until removed', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const listener = vi.fn();
        interceptor.on('connection', listener);
        await promiseIfRemote(interceptor.message(), interceptor);

        const firstClient = await createClient();
        await waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(1);
        });
        await firstClient.close();
        await promiseIfRemote(interceptor.clear(), interceptor);
        await promiseIfRemote(interceptor.message(), interceptor);

        const secondClient = await createClient();
        await waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(2);
        });
        await secondClient.close();
        await interceptor.stop();
        await interceptor.start();
        await promiseIfRemote(interceptor.message(), interceptor);

        const thirdClient = await createClient();
        await waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(3);
        });
        await thirdClient.close();
        interceptor.off('connection', listener);

        const retainedListener = vi.fn();
        interceptor.on('connection', retainedListener);
        await createClient();
        await waitFor(() => {
          expect(retainedListener).toHaveBeenCalledTimes(1);
        });
        expect(listener).toHaveBeenCalledTimes(3);
      });
    });

    it('should retain one-time listeners across clear, stop, and restart and deliver only once', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const listener = vi.fn();
        const retainedListener = vi.fn();
        interceptor.once('connection', listener);
        interceptor.on('connection', retainedListener);

        await promiseIfRemote(interceptor.clear(), interceptor);
        await interceptor.stop();
        await interceptor.start();
        await promiseIfRemote(interceptor.message(), interceptor);

        await createClient();
        await waitFor(() => {
          expect(retainedListener).toHaveBeenCalledTimes(1);
        });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(interceptor.clients[0]);

        await createClient();
        await waitFor(() => {
          expect(retainedListener).toHaveBeenCalledTimes(2);
        });
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  if (type === 'local') {
    it('should create a typed local interceptor by default', () => {
      const interceptor = createWebSocketInterceptor<MessageSchema>({ baseURL });

      expect(interceptor.type).toBe('local');

      expectTypeOf(interceptor.message).parameters.toEqualTypeOf<[]>();
      expectTypeOf(interceptor.checkTimes).returns.toEqualTypeOf<void>();
      expectTypeOf(interceptor.clear).returns.toEqualTypeOf<void>();
    });
  }

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);
    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });

  if (type === 'remote') {
    describe('Authentication', () => {
      it('should support changing the authentication options while stopped', () => {
        const interceptor = createWebSocketInterceptor<{}>({ type, baseURL });

        expect(interceptor.auth).toBe(undefined);

        const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };
        interceptor.auth = auth;
        expect(interceptor.auth).toEqual(auth);

        interceptor.auth.token = 'other-token';
        expect(interceptor.auth).toEqual({ token: 'other-token' });

        interceptor.auth = undefined;
        expect(interceptor.auth).toBe(undefined);
      });

      it('should not support changing the authentication options while running', async () => {
        const interceptor = createWebSocketInterceptor<{}>({ type, baseURL });

        try {
          await interceptor.start();

          expect(() => {
            interceptor.auth = { token: 'token' };
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          await interceptor.stop();

          const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };
          interceptor.auth = auth;
          await interceptor.start();

          expect(() => {
            interceptor.auth!.token = 'other-token';
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual({ token: 'token' });
        } finally {
          await interceptor.stop();
        }
      });

      it('should guard constructor-provided authentication options while running', async () => {
        const auth: RemoteWebSocketInterceptorOptions['auth'] = { token: 'token' };
        const interceptor = createWebSocketInterceptor<{}>({ type, baseURL, auth });

        try {
          await interceptor.start();

          expect(() => {
            interceptor.auth!.token = 'other-token';
          }).toThrow(
            new RunningWebSocketInterceptorError(
              'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?',
            ),
          );

          expect(interceptor.auth).toEqual({ token: 'token' });
        } finally {
          await interceptor.stop();
        }
      });
    });

    it('should register handler base URLs and resolve pending handlers after the registration completes', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await expectClientToCloseAsUnhandled();

        const handler = interceptor.message().respond({ type: 'server', index: 1 });
        await handler;

        const client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });

    it('should reset server registrations after cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await interceptor.message().respond({ type: 'server', index: 1 });

        let client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
        await client.close();

        await interceptor.clear();
        await expectClientToCloseAsUnhandled();

        await interceptor.message().respond({ type: 'server', index: 2 });
        client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });

    it('should reset server registrations after stopped', async () => {
      const interceptor = createWebSocketInterceptor<MessageSchema>(interceptorOptions);

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        const client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
        await client.close();

        await interceptor.stop();
        await expectClientToCloseAsUnhandled();
      } finally {
        await interceptor.stop();
      }
    });
  }

  it('should not support changing the base URL while starting', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;
    let startPromise = Promise.resolve();

    try {
      startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = new URL('new', baseURL).toString();
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled([startPromise]);
      await interceptor.stop();
    }
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    const interceptor = createWebSocketInterceptor<Schema>({ type, baseURL: getBaseURL() });
    const baseURL = interceptor.baseURL;
    const otherBaseURL = new URL('new', baseURL).toString();

    const startPromise = interceptor.start();
    const stopPromise = interceptor.stop();

    try {
      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);
      expect(interceptor.baseURL).toBe(baseURL);
    } finally {
      await Promise.allSettled([startPromise, stopPromise]);
      await interceptor.stop();
    }
  });
}
