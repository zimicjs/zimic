import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect, it } from 'vitest';

import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

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
    const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());
    const server = interceptor.server;
    const initialBaseURL = new URL(getBaseURL());

    const changedBaseURLs = [
      new URL('/other-path', initialBaseURL),
      new URL(initialBaseURL),
      new URL(initialBaseURL),
      new URL(initialBaseURL),
    ];

    changedBaseURLs[1].hostname = initialBaseURL.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    changedBaseURLs[2].protocol = initialBaseURL.protocol === 'ws:' ? 'wss:' : 'ws:';
    changedBaseURLs[3].port = initialBaseURL.port === '43210' ? '43211' : '43210';

    for (const changedBaseURL of changedBaseURLs) {
      interceptor.baseURL = changedBaseURL.href;
      expect(interceptor.baseURL).toBe(changedBaseURL.href.replace(/\/$/, ''));
      expect(interceptor.server).toBe(server);
      expect(server.url).toBe(interceptor.baseURL);
    }
  });

  if (type === 'remote' && getAlternativeBaseURL) {
    it('should use a new server origin after the base URL changes', async () => {
      const baseURL = getBaseURL();
      const alternativeBaseURL = getAlternativeBaseURL();
      const interceptor = createWebSocketInterceptor<MessageSchema>(getInterceptorOptions());

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        const initialClient = new WebSocketClient<MessageSchema>(baseURL);
        await initialClient.open();
        await initialClient.close();

        await interceptor.stop();
        interceptor.baseURL = alternativeBaseURL;
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 2 });

        const oldOriginClient = new WebSocketClient<MessageSchema>(baseURL);
        const closeEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
          oldOriginClient.addEventListener('close', resolve, { once: true });
        });

        await oldOriginClient.open();
        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
        expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');

        const alternativeClient = new WebSocketClient<MessageSchema>(alternativeBaseURL);
        await alternativeClient.open();
        await alternativeClient.close();
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
