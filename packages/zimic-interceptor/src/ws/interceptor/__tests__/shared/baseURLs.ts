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
  const { type, getBaseURL, getAlternativeBaseURL, getInterceptorOptions } = options;

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

  it('should support changing every base URL component while stopped', () => {
    const initialBaseURLs = Array.from({ length: 7 }, () => new URL(getBaseURL()));
    initialBaseURLs[0].hostname = 'localhost';
    initialBaseURLs[1].hostname = '127.0.0.1';
    initialBaseURLs[2].protocol = 'ws:';
    initialBaseURLs[3].protocol = 'wss:';
    initialBaseURLs[4].port = '43210';
    initialBaseURLs[5].port = '43211';
    initialBaseURLs[6].pathname = '/initial-path';

    const changedBaseURLs = initialBaseURLs.map((baseURL) => new URL(baseURL));
    changedBaseURLs[0].hostname = '127.0.0.1';
    changedBaseURLs[1].hostname = 'localhost';
    changedBaseURLs[2].protocol = 'wss:';
    changedBaseURLs[3].protocol = 'ws:';
    changedBaseURLs[4].port = '43211';
    changedBaseURLs[5].port = '43210';
    changedBaseURLs[6].pathname = '/other-path';

    for (const [index, initialBaseURL] of initialBaseURLs.entries()) {
      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...getInterceptorOptions(),
        baseURL: initialBaseURL.href,
      });
      const server = interceptor.server;
      const changedBaseURL = changedBaseURLs[index];

      interceptor.baseURL = changedBaseURL.href;
      expect(interceptor.baseURL).toBe(changedBaseURL.href.replace(/\/$/, ''));
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);
    }
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

  if (type === 'remote' && getAlternativeBaseURL) {
    it('should use a new server origin after the base URL changes', async () => {
      const baseURL = getBaseURL();
      const alternativeBaseURL = getAlternativeBaseURL();
      const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        await usingWebSocketClient<MessageSchema>(baseURL, () => undefined);

        await interceptor.stop();
        interceptor.baseURL = alternativeBaseURL;
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

        await usingWebSocketClient<MessageSchema>(alternativeBaseURL, async (client) => {
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
