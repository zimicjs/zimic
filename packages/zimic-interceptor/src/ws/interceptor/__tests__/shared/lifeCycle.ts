import { waitFor } from '@zimic/utils/time';
import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, expectTypeOf, it } from 'vitest';

import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorOptions } from '../../types/options';
import {
  SUPPORTED_BASE_URL_PROTOCOLS,
  DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
} from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;
  let clients: WebSocketClient<MessageSchema>[];

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
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
    clients.push(client);

    await client.open({ timeout: options.timeout });

    return client;
  }

  async function expectClientToCloseAsUnhandled() {
    const client = new WebSocketClient<MessageSchema>(baseURL);
    clients.push(client);

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

  it('should support changing the base URL after created and stopped', async () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>(interceptorOptions);

    try {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      const newBaseURL = joinURL(baseURL, 'new').replace(/\/$/, '');
      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL);

      await interceptor.start();

      expect(() => {
        interceptor.baseURL = baseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(newBaseURL);

      await interceptor.stop();

      interceptor.baseURL = baseURL;
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
    } finally {
      await interceptor.stop();
    }
  });

  it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
    'should not throw an error if provided a supported base URL protocol (%s)',
    (supportedProtocol) => {
      const supportedBaseURL = baseURL.replace(/^ws/, supportedProtocol);

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...interceptorOptions,
        baseURL: supportedBaseURL,
      });

      expect(interceptor.baseURL).toBe(supportedBaseURL.replace(/\/$/, ''));
    },
  );

  const exampleUnsupportedProtocols = ['http', 'https', 'ftp'];

  it.each(exampleUnsupportedProtocols)(
    'should throw an error if provided an unsupported base URL protocol (%s)',
    (unsupportedProtocol) => {
      expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

      const unsupportedBaseURL = baseURL.replace(/^ws/, unsupportedProtocol);

      expect(() => {
        createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL: unsupportedBaseURL });
      }).toThrow(new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS));
    },
  );

  it('should exclude non-path base URL parameters', () => {
    const baseURLWithNonPathParameters = `${baseURL}?search=value#hash`;

    const interceptor = createWebSocketInterceptor<MessageSchema>({
      ...interceptorOptions,
      baseURL: baseURLWithNonPathParameters,
    });

    expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
  });

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);
    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should clear handler state', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      interceptor.message().respond({}).times(1);

      await expect(async () => {
        await interceptor.checkTimes();
      }).rejects.toThrow('Expected exactly 1 message, but got 0.');

      await interceptor.clear();
      await interceptor.checkTimes();
    });
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

  it('should have the correct default message saving configuration if none is provided', () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, messageSaving: undefined });

    expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
      enabled: platform === 'node',
      safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    });
  });

  if (type === 'local') {
    it('should warn if saved messages exceed the safe limit', async () => {
      const safeLimit = 2;

      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'local', baseURL, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'server', index: 1 });
          const client = await createClient();

          await usingIgnoredConsole(['warn'], async (console) => {
            const numberOfMessages = safeLimit + 1;

            for (let index = 0; index < numberOfMessages; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(numberOfMessages);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(3, safeLimit));
          });
        },
      );
    });

    it('should reset the saved message count after cleared', async () => {
      const safeLimit = 1;

      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'local', baseURL, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'server', index: 1 });
          const client = await createClient();

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < 2; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);

            interceptor.clear();
            handler.respond({ type: 'server', index: 2 });
            console.warn.mockClear();

            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });
  }
}
