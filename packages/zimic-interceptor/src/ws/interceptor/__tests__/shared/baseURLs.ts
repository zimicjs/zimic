import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketSchema } from '@zimic/ws';
import { expect, it } from 'vitest';

import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareBaseURLWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  it('should support changing the base URL after created and stopped', async () => {
    const baseURL = getBaseURL();
    const interceptorOptions = getInterceptorOptions();
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
