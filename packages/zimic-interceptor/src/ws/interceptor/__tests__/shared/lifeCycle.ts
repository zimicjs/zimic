import { WebSocketClient, WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { LocalWebSocketMessageHandler } from '../../../messageHandler/LocalWebSocketMessageHandler';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorOptions } from '../../types/options';
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

  it('should use the base WebSocket client transport for standalone clients', () => {
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL(baseURL),
      Handler: LocalWebSocketMessageHandler,
    });
    const client = interceptor.createClient(baseURL);
    const rawSend = JSON.stringify({ type: 'client' as const, index: 1 }) as WebSocketMessageData<MessageSchema>;
    const sendSpy = vi.spyOn(WebSocketClient.prototype, 'send').mockImplementation(() => undefined);

    try {
      client.send(rawSend);

      expect(sendSpy).toHaveBeenCalledWith(rawSend);
    } finally {
      sendSpy.mockRestore();
    }
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
    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  }

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

        auth.token = 'other-token';
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
}
