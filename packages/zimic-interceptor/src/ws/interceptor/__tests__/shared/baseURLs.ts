import { waitForNot } from '@zimic/utils/time';
import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorOptions } from '../../types/options';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareBaseURLWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getOtherBaseURL, getInterceptorOptions } = options;

  let defaultBaseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    defaultBaseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should handle base URLs and paths correctly', async () => {
    // WebSocket handlers have no per-handler path, so the path is only part of the base URL.
    const baseURLWithoutSlash = defaultBaseURL.replace(/\/$/, '');
    const baseURLWithPathWithoutSlash = joinURL(baseURLWithoutSlash, 'path');

    for (const baseURL of [
      baseURLWithoutSlash,
      `${baseURLWithoutSlash}/`,
      baseURLWithPathWithoutSlash,
      `${baseURLWithPathWithoutSlash}/`,
    ]) {
      await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
        });
      });
    }
  });

  it('should support changing the base URL after created', async () => {
    const baseURL = defaultBaseURL;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL.replace(/\/$/, ''));

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 2 }), interceptor);

      const oldBaseURLMessageListener = vi.fn();

      // Depending on the mode, the old base URL either refuses the connection or accepts it without handling messages.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.addEventListener('message', oldBaseURLMessageListener);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitForNot(() => {
            expect(oldBaseURLMessageListener).toHaveBeenCalled();
          });
        }),
      ]);
      expect(oldBaseURLMessageListener).not.toHaveBeenCalled();

      await usingWebSocketClient<MessageSchema>(newBaseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
      });
    });
  });

  // WebSocket interceptors expose a long-lived server handle, which must follow every base URL component change.
  it.each([
    { component: 'hostname', initial: 'localhost', changed: '127.0.0.1' },
    { component: 'hostname', initial: '127.0.0.1', changed: 'localhost' },
    { component: 'protocol', initial: 'ws:', changed: 'wss:' },
    { component: 'protocol', initial: 'wss:', changed: 'ws:' },
    { component: 'port', initial: '43210', changed: '43211' },
    { component: 'port', initial: '43211', changed: '43210' },
    { component: 'pathname', initial: '/initial-path', changed: '/other-path' },
  ] as const)(
    'should support changing the base URL $component from $initial to $changed while stopped',
    ({ component, initial, changed }) => {
      const initialBaseURL = new URL(defaultBaseURL);
      initialBaseURL[component] = initial;

      const changedBaseURL = new URL(initialBaseURL);
      changedBaseURL[component] = changed;

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...interceptorOptions,
        baseURL: initialBaseURL.href,
      });
      const server = interceptor.server;

      interceptor.baseURL = changedBaseURL.href;
      expect(interceptor.baseURL).toBe(changedBaseURL.href.replace(/\/$/, ''));
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);
    },
  );

  it('should not support changing the base URL while starting', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (interceptor) => {
      const startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;

      expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
    });
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, { start: false }, async (interceptor) => {
      const otherBaseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      expect(otherBaseURL).not.toBe(interceptor.baseURL);

      const startPromise = interceptor.start();
      const stopPromise = interceptor.stop();

      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);

      expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
    });
  });

  it('should not support changing the base URL if the interceptor is running', async () => {
    const baseURL = defaultBaseURL;

    await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      expect(interceptor.isRunning).toBe(true);

      expect(() => {
        interceptor.baseURL = newBaseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      const newBaseURLMessageListener = vi.fn();

      // Depending on the mode, the new base URL either refuses the connection or accepts it without handling messages.
      await Promise.allSettled([
        usingWebSocketClient<MessageSchema>(newBaseURL, async (client) => {
          client.addEventListener('message', newBaseURLMessageListener);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await waitForNot(() => {
            expect(newBaseURLMessageListener).toHaveBeenCalled();
          });
        }),
      ]);
      expect(newBaseURLMessageListener).not.toHaveBeenCalled();

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 1 }));
      });
    });
  });

  it('should throw an error if provided an invalid base URL', async () => {
    const handler = vi.fn();

    const invalidURL = 'invalid';

    await expect(async () => {
      await usingWebSocketInterceptor({ ...interceptorOptions, baseURL: invalidURL }, handler);
    }).rejects.toThrow(/Invalid URL/);

    expect(handler).not.toHaveBeenCalled();
  });

  // The WebSocket interceptor does not validate the type of the base URL. It passes the value to the URL constructor,
  // which coerces objects to strings, so a URL instance is a valid input and has no invalid variant to test.
  const invalidBaseURLs = [
    { label: 'undefined', value: undefined },
    { label: 'null', value: null },
    { label: 'a number', value: 5 },
    { label: 'a boolean', value: true },
    { label: 'an object', value: {} },
    { label: 'an array', value: [] },
  ];

  it.each(invalidBaseURLs)(
    'should throw an error if provided a base URL that is not a string ($label)',
    async ({ value }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid base URL type.
      const invalidBaseURL: string = value;

      await expect(async () => {
        await usingWebSocketInterceptor({ ...interceptorOptions, baseURL: invalidBaseURL }, handler);
      }).rejects.toThrow(/Invalid URL/);

      expect(handler).not.toHaveBeenCalled();
    },
  );

  if (type === 'remote' && getOtherBaseURL) {
    // WebSocket connections are long-lived and bound to the server that accepted them, so moving to another server
    // origin must stop handling connections on the previous one.
    it('should use a new server origin after the base URL changes', async () => {
      const baseURL = defaultBaseURL;
      const otherBaseURL = getOtherBaseURL();

      await usingWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        await interceptor.stop();
        interceptor.baseURL = otherBaseURL;
        await interceptor.start();

        await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 2 }), interceptor);

        const oldOriginMessageListener = vi.fn();

        await Promise.allSettled([
          usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            client.addEventListener('message', oldOriginMessageListener);
            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitForNot(() => {
              expect(oldOriginMessageListener).toHaveBeenCalled();
            });
          }),
        ]);
        expect(oldOriginMessageListener).not.toHaveBeenCalled();

        await usingWebSocketClient<MessageSchema>(otherBaseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', index: 2 }));
        });
      });
    });
  }

  it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
    'should not throw an error if provided a supported base URL protocol (%s)',
    (supportedProtocol) => {
      const supportedBaseURL = defaultBaseURL.replace(/^ws/, supportedProtocol);

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

      const unsupportedBaseURL = defaultBaseURL.replace(/^ws/, unsupportedProtocol);

      expect(() => {
        createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL: unsupportedBaseURL });
      }).toThrow(new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS));
    },
  );

  // WebSocket connection URLs commonly carry query parameters, which must not become part of the base URL.
  it('should exclude non-path base URL parameters', () => {
    const baseURLWithNonPathParameters = `${defaultBaseURL}?search=value#hash`;

    const interceptor = createWebSocketInterceptor<MessageSchema>({
      ...interceptorOptions,
      baseURL: baseURLWithNonPathParameters,
    });

    expect(interceptor.baseURL).toBe(defaultBaseURL.replace(/\/$/, ''));
  });
}
