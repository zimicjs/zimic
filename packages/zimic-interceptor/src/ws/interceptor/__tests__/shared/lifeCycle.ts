import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, expectTypeOf, it } from 'vitest';

import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorOptions } from '../../types/options';
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
