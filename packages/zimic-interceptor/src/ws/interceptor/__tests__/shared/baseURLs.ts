import { waitFor } from '@zimic/utils/time';
import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it } from 'vitest';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareBaseURLWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getOtherBaseURL, getInterceptorOptions } = options;

  it('should support changing the base URL after created and stopped', async () => {
    const baseURL = getBaseURL();
    const interceptorOptions = getInterceptorOptions();
    const interceptor = createWebSocketInterceptor<MessageSchema>(interceptorOptions);
    const server = interceptor.server;

    try {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);

      const newBaseURL = joinURL(baseURL, 'new').replace(/\/$/, '');
      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL);
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(newBaseURL);

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
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);
    } finally {
      await interceptor.stop();
    }
  });

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
      const initialBaseURL = new URL(getBaseURL());
      initialBaseURL[component] = initial;

      const changedBaseURL = new URL(initialBaseURL);
      changedBaseURL[component] = changed;

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...getInterceptorOptions(),
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
    const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());
    const baseURL = interceptor.baseURL;
    let startPromise = Promise.resolve();

    try {
      startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = getOtherBaseURL?.() ?? joinURL(baseURL, 'new');
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
    const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());
    const baseURL = interceptor.baseURL;
    const otherBaseURL = getOtherBaseURL?.() ?? joinURL(baseURL, 'new');
    expect(otherBaseURL).not.toBe(baseURL);

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

  it.each([{ label: 'without' }, { label: 'with' }])(
    'should handle base URLs $label a trailing slash correctly',
    async ({ label }) => {
      const baseURLWithoutSlash = getBaseURL().replace(/\/$/, '');
      const baseURL = label === 'with' ? `${baseURLWithoutSlash}/` : baseURLWithoutSlash;
      const interceptor = createWebSocketInterceptor<MessageSchema>({ ...getInterceptorOptions(), baseURL });

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 1 }));

          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
        });
      } finally {
        await interceptor.stop();
      }
    },
  );

  it('should throw an error if provided an invalid base URL', () => {
    expect(() => {
      createWebSocketInterceptor<MessageSchema>({ ...getInterceptorOptions(), baseURL: 'invalid' });
    }).toThrow(/Invalid URL/);
  });

  if (type === 'local') {
    it('should use a new local base URL after stopped and restarted', async () => {
      const baseURL = getBaseURL();
      const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());
      const newBaseURL = joinURL(baseURL, 'new').replace(/\/$/, '');

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        const initialClient = new WebSocketClient<MessageSchema>(baseURL);
        try {
          await initialClient.open();

          const messagePromise = waitForWebSocketMessage(initialClient);
          initialClient.send(JSON.stringify({ type: 'client', index: 1 }));

          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
        } finally {
          await initialClient.close();
        }

        await interceptor.stop();

        interceptor.baseURL = newBaseURL;
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 2 });

        const oldBaseURLClient = new WebSocketClient<MessageSchema>(baseURL);
        try {
          let rejectionEvent: WebSocketClient.ErrorEvent<MessageSchema> | undefined;
          function handleRejection(event: WebSocketClient.ErrorEvent<MessageSchema>) {
            rejectionEvent = event;
          }
          oldBaseURLClient.addEventListener('error', handleRejection, { once: true });
          oldBaseURLClient.addEventListener('close', handleRejection, { once: true });

          await Promise.allSettled([oldBaseURLClient.open({ timeout: 500 })]);
          await waitFor(() => {
            expect(rejectionEvent).toHaveProperty('type', expect.stringMatching(/^(error|close)$/));
          });
        } finally {
          await Promise.allSettled([oldBaseURLClient.close()]);
        }

        const newBaseURLClient = new WebSocketClient<MessageSchema>(newBaseURL);
        try {
          await newBaseURLClient.open();

          const messagePromise = waitForWebSocketMessage(newBaseURLClient);
          newBaseURLClient.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        } finally {
          await newBaseURLClient.close();
        }
      } finally {
        await interceptor.stop();
      }
    });
  }

  if (type === 'remote' && getOtherBaseURL) {
    it('should use a new server origin after the base URL changes', async () => {
      const baseURL = getBaseURL();
      const otherBaseURL = getOtherBaseURL();
      const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketClient<MessageSchema>(baseURL, () => undefined);

        await interceptor.stop();
        interceptor.baseURL = otherBaseURL;
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 2 });

        const oldOriginClient = new WebSocketClient<MessageSchema>(baseURL);
        try {
          let rejectionEvent: WebSocketClient.ErrorEvent<MessageSchema> | undefined;
          function handleRejection(event: WebSocketClient.ErrorEvent<MessageSchema>) {
            rejectionEvent = event;
          }
          oldOriginClient.addEventListener('error', handleRejection, { once: true });
          oldOriginClient.addEventListener('close', handleRejection, { once: true });

          await Promise.allSettled([oldOriginClient.open({ timeout: 500 })]);
          await waitFor(() => {
            expect(rejectionEvent).toHaveProperty('type', expect.stringMatching(/^(error|close)$/));
          });
        } finally {
          await Promise.allSettled([oldOriginClient.close()]);
        }

        await usingWebSocketClient<MessageSchema>(otherBaseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        });
      } finally {
        await interceptor.stop();
      }
    });
  }

  it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
    'should not throw an error if provided a supported base URL protocol (%s)',
    (supportedProtocol) => {
      const baseURL = getBaseURL();
      const interceptorOptions = getInterceptorOptions();
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
      const baseURL = getBaseURL();
      const interceptorOptions = getInterceptorOptions();

      expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

      const unsupportedBaseURL = baseURL.replace(/^ws/, unsupportedProtocol);

      expect(() => {
        createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL: unsupportedBaseURL });
      }).toThrow(new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS));
    },
  );

  it('should exclude non-path base URL parameters', () => {
    const baseURL = getBaseURL();
    const interceptorOptions = getInterceptorOptions();
    const baseURLWithNonPathParameters = `${baseURL}?search=value#hash`;

    const interceptor = createWebSocketInterceptor<MessageSchema>({
      ...interceptorOptions,
      baseURL: baseURLWithNonPathParameters,
    });

    expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
  });
}
