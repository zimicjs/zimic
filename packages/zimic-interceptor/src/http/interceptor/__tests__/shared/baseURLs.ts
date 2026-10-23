import { expectFetchError } from '@zimic/utils/fetch';
import { joinURL, UnsupportedURLProtocolError } from '@zimic/utils/url';
import { ValidationError } from '@zimic/utils/validation';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { expectBypassedResponse } from '@tests/utils/fetch';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import RunningHttpInterceptorError from '../../errors/RunningHttpInterceptorError';
import { SUPPORTED_BASE_URL_PROTOCOLS } from '../../HttpInterceptorImplementation';
import { HttpInterceptorOptions, UnhandledRequestStrategy } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions, verifyUnhandledRequestMessage } from './utils';

export function declareBaseURLHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getOtherBaseURL, getInterceptorOptions } = options;

  let defaultBaseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    defaultBaseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should handle base URLs and paths correctly', async () => {
    for (const { baseURL, path } of [
      { baseURL: defaultBaseURL.toString().replace(/\/$/, ''), path: 'path' },
      { baseURL: defaultBaseURL.toString(), path: 'path' },
      { baseURL: defaultBaseURL.toString().replace(/\/$/, ''), path: '/path' },
      { baseURL: defaultBaseURL.toString(), path: '/path' },
    ]) {
      await usingHttpInterceptor<{
        ':any': {
          GET: {
            response: {
              200: {};
            };
          };
        };
      }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
        expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

        const handler = await promiseIfRemote(interceptor.get(path).respond({ status: 200 }), interceptor);

        expect(handler.requests).toHaveLength(0);

        const url = joinURL(baseURL, path);

        const response = await fetch(url, { method: 'GET' });
        expect(response.status).toBe(200);

        expect(handler.requests).toHaveLength(1);
        const [request] = handler.requests;
        expect(request).toBeInstanceOf(Request);

        expectTypeOf(request.body).toEqualTypeOf<null>();
        expect(request.body).toBe(null);

        expectTypeOf(request.response.status).toEqualTypeOf<200>();
        expect(request.response.status).toBe(200);

        expectTypeOf(request.response.body).toEqualTypeOf<null>();
        expect(request.response.body).toBe(null);
      });
    }
  });

  it('should intercept requests sent to the base URL with a trailing slash', async () => {
    const baseURL = joinURL(defaultBaseURL.replace(/\/$/, ''), 'path');

    await usingHttpInterceptor<{
      '/': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      const response = await fetch(`${baseURL}/`, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);
    });
  });

  // No HTTP counterpart for "should intercept messages sent to URLs that extend the last path segment of the base URL":
  // HTTP requests also need a matching handler path, so the base URL alone does not decide which requests are
  // intercepted.

  // No HTTP counterpart for "should intercept messages sent to the base URL with search params": HTTP requests also need
  // a matching handler path, so the base URL alone does not decide which requests are intercepted.

  // No HTTP counterpart for "should not intercept messages sent to URLs not starting with the base URL": HTTP requests
  // also need a matching handler path, so the base URL alone does not decide which requests are intercepted.

  // No HTTP counterpart for "should not intercept messages sent to the base URL without its trailing slash": HTTP
  // requests also need a matching handler path, so the base URL alone does not decide which requests are intercepted.

  // Remote interceptors connect to an interceptor server at their base URL, so they cannot use a port where no server
  // listens.
  if (type === 'local') {
    it('should not intercept requests sent to another port starting with the base URL port', async () => {
      const { protocol, hostname, port } = new URL(defaultBaseURL);
      const otherPortBaseURL = `${protocol}//${hostname}:${port.slice(0, -1)}`;
      expect(defaultBaseURL.startsWith(otherPortBaseURL)).toBe(true);

      const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.LocalDeclarationFactory>(() => ({
        action: 'bypass',
        log: false,
      }));

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 200: {} } } };
      }>({ type: 'local', baseURL: otherPortBaseURL, onUnhandledRequest }, async (interceptor) => {
        const handler = interceptor.get('/users').respond({ status: 200 });

        // The request reaches the network, where the server at the base URL responds.
        await expectBypassedResponse(fetch(joinURL(defaultBaseURL, 'users'), { method: 'GET' }));
        expect(handler.requests).toHaveLength(0);
        expect(onUnhandledRequest).not.toHaveBeenCalled();
      });
    });
  }

  // No HTTP counterpart for "should intercept messages sent to socket.io paths under the base URL": MSW rewrites
  // socket.io paths only for WebSocket connections.

  // No HTTP counterpart for "should intercept messages sent to socket.io paths under a socket.io base URL (%s)": MSW
  // rewrites socket.io paths only for WebSocket connections.

  // No HTTP counterpart for "should intercept messages sent to other paths only with their interceptor while a socket.io
  // base URL interceptor is running": MSW rewrites socket.io paths only for WebSocket connections.

  // No HTTP counterpart for "should not intercept messages sent to a socket.io base URL without its socket.io path (%s)":
  // MSW rewrites socket.io paths only for WebSocket connections.

  it('should intercept requests with the last started interceptor if multiple interceptors match', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor.get('/users').respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

        const response = await fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });

  it('should intercept requests with the last started interceptor if an older one declares its handlers later', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.get('/users').respond({ status: 204 }), interceptor);

        const olderHandler = await promiseIfRemote(
          olderInterceptor.get('/users').respond({ status: 200 }),
          olderInterceptor,
        );

        const response = await fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handler.requests).toHaveLength(1);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });

  it('should intercept requests with an older interceptor that declares its handlers later if the last started one has no matching handlers', async () => {
    const restriction = vi.fn(() => false);

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').with(restriction).respond({ status: 204 }),
          interceptor,
        );

        const olderHandler = await promiseIfRemote(
          olderInterceptor.get('/users').respond({ status: 200 }),
          olderInterceptor,
        );

        const response = await fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);

        expect(restriction).toHaveBeenCalledTimes(1);
        expect(handler.requests).toHaveLength(0);
        expect(olderHandler.requests).toHaveLength(1);
      });
    });
  });

  it('should intercept requests with an older interceptor if the last started one has no matching handlers', async () => {
    const restriction = vi.fn(() => false);

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor.get('/users').respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').with(restriction).respond({ status: 204 }),
          interceptor,
        );

        const response = await fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);

        expect(restriction).toHaveBeenCalledTimes(1);
        expect(handler.requests).toHaveLength(0);
        expect(olderHandler.requests).toHaveLength(1);
      });
    });
  });

  it('should intercept requests with an older interceptor if the last started one has a nested base URL and no matching handlers', async () => {
    const nestedBaseURL = joinURL(defaultBaseURL, 'nested');
    const restriction = vi.fn(() => false);

    await usingHttpInterceptor<{
      '/nested/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor.get('/nested/users').respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ ...interceptorOptions, baseURL: nestedBaseURL }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.get('/users').with(restriction).respond({ status: 204 }),
          interceptor,
        );

        const response = await fetch(joinURL(nestedBaseURL, '/users'), { method: 'GET' });
        expect(response.status).toBe(200);

        expect(restriction).toHaveBeenCalledTimes(1);
        expect(handler.requests).toHaveLength(0);
        expect(olderHandler.requests).toHaveLength(1);
      });
    });
  });

  it('should apply the unhandled request strategy of the last started interceptor once if no interceptor handles a request', async () => {
    const olderOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>({ ...interceptorOptions, onUnhandledRequest: olderOnUnhandledRequest }, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor
          .get('/users')
          .with(() => false)
          .respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ ...interceptorOptions, onUnhandledRequest }, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .get('/users')
            .with(() => false)
            .respond({ status: 204 }),
          interceptor,
        );

        await expectFetchError(fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' }));

        expect(handler.requests).toHaveLength(0);
        expect(olderHandler.requests).toHaveLength(0);

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(olderOnUnhandledRequest).not.toHaveBeenCalled();
      });
    });
  });

  it('should apply the unhandled request strategy of the last started interceptor once if it has a nested base URL and no handlers', async () => {
    const nestedBaseURL = joinURL(defaultBaseURL, 'nested');

    const olderOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{
      '/nested/users': { GET: { response: { 200: {} } } };
    }>({ ...interceptorOptions, onUnhandledRequest: olderOnUnhandledRequest }, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor
          .get('/nested/users')
          .with(() => false)
          .respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{}>(
        { ...interceptorOptions, baseURL: nestedBaseURL, onUnhandledRequest },
        async () => {
          await expectFetchError(fetch(joinURL(nestedBaseURL, '/users'), { method: 'GET' }));

          expect(olderHandler.requests).toHaveLength(0);

          expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
          expect(olderOnUnhandledRequest).not.toHaveBeenCalled();
        },
      );
    });
  });

  it('should apply the unhandled request strategy of the last started interceptor once if no interceptor has handlers', async () => {
    const olderOnUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    const onUnhandledRequest = vi.fn<UnhandledRequestStrategy.RemoteDeclarationFactory>(() => ({
      action: 'reject',
      log: false,
    }));

    await usingHttpInterceptor<{}>({ ...interceptorOptions, onUnhandledRequest: olderOnUnhandledRequest }, async () => {
      await usingHttpInterceptor<{}>({ ...interceptorOptions, onUnhandledRequest }, async () => {
        await expectFetchError(fetch(joinURL(defaultBaseURL, '/users'), { method: 'GET' }));

        expect(onUnhandledRequest).toHaveBeenCalledTimes(1);
        expect(olderOnUnhandledRequest).not.toHaveBeenCalled();
      });
    });
  });

  it('should not try older interceptors if the last started one throws while handling a request', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: { response: { 200: {} } } };
    }>(interceptorOptions, async (olderInterceptor) => {
      const olderHandler = await promiseIfRemote(
        olderInterceptor.get('/users').respond({ status: 200 }),
        olderInterceptor,
      );

      await usingHttpInterceptor<{
        '/users': { GET: { response: { 204: {} } } };
      }>({ ...interceptorOptions, onUnhandledRequest: { action: 'reject', log: true } }, async (interceptor) => {
        const error = new Error('An error occurred.');

        const handler = await promiseIfRemote(
          interceptor.get('/users').respond(() => {
            throw error;
          }),
          interceptor,
        );

        await usingIgnoredConsole(['error', 'warn'], async (console) => {
          const request = new Request(joinURL(defaultBaseURL, '/users'), { method: 'GET' });
          await expectFetchError(fetch(request));

          expect(console.error).toHaveBeenCalledTimes(2);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error.mock.calls[0]).toEqual([error]);

          const errorMessage = console.error.mock.calls[1].join(' ');
          await verifyUnhandledRequestMessage(errorMessage, { request, platform, type: 'reject' });
        });

        expect(handler.requests).toHaveLength(0);
        expect(olderHandler.requests).toHaveLength(0);
      });
    });
  });

  it('should support changing the base URL after created', async () => {
    const baseURL = defaultBaseURL.toString();

    await usingHttpInterceptor<{
      '/': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.toString().replace(/\/$/, ''));

      let handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);

      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL.replace(/\/$/, ''));

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      const responsePromise = fetch(baseURL, { method: 'GET' });

      if (type === 'local') {
        await expectBypassedResponse(responsePromise);
      } else {
        await expectFetchError(responsePromise);
      }

      expect(handler.requests).toHaveLength(0);

      response = await fetch(newBaseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);
    });
  });

  it('should not support changing the base URL while starting', async () => {
    await usingHttpInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      const startPromise = interceptor.start();

      expect(() => {
        interceptor.baseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await startPromise;

      expect(interceptor.baseURL).toBe(interceptorOptions.baseURL);
    });
  });

  it('should not support changing the base URL while stopping during startup', async () => {
    await usingHttpInterceptor<{}>(interceptorOptions, { start: false }, async (interceptor) => {
      const otherBaseURL = getOtherBaseURL?.() ?? joinURL(defaultBaseURL, 'new');
      expect(otherBaseURL).not.toBe(interceptor.baseURL);

      const startPromise = interceptor.start();
      const stopPromise = interceptor.stop();

      expect(() => {
        interceptor.baseURL = otherBaseURL;
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      await Promise.all([startPromise, stopPromise]);

      expect(interceptor.baseURL).toBe(interceptorOptions.baseURL);
    });
  });

  it('should not support changing the base URL if the interceptor is running', async () => {
    const baseURL = defaultBaseURL.toString();

    await usingHttpInterceptor<{
      '/': {
        GET: {
          response: {
            200: {};
          };
        };
      };
    }>({ ...interceptorOptions, baseURL }, async (interceptor) => {
      expect(interceptor.baseURL).toBe(baseURL.toString().replace(/\/$/, ''));

      let handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);

      const newBaseURL = joinURL(baseURL, 'new');
      expect(newBaseURL).not.toBe(interceptor.baseURL);

      expect(interceptor.isRunning).toBe(true);

      expect(() => {
        interceptor.baseURL = newBaseURL;
      }).toThrow(
        new RunningHttpInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      handler = await promiseIfRemote(interceptor.get('/').respond({ status: 200 }), interceptor);

      expect(handler.requests).toHaveLength(0);

      await expectFetchError(fetch(newBaseURL, { method: 'GET' }));

      expect(handler.requests).toHaveLength(0);

      response = await fetch(baseURL, { method: 'GET' });
      expect(response.status).toBe(200);

      expect(handler.requests).toHaveLength(1);
    });
  });

  it('should throw an error if provided an invalid base URL', async () => {
    const handler = vi.fn();

    const invalidURL = 'invalid';

    await expect(async () => {
      await usingHttpInterceptor({ ...interceptorOptions, baseURL: invalidURL }, handler);
    }).rejects.toThrow(/Invalid URL/);

    expect(handler).not.toHaveBeenCalled();
  });

  const invalidBaseURLs = [
    { label: 'undefined', value: undefined, expectedType: 'undefined' },
    { label: 'null', value: null, expectedType: 'null' },
    { label: 'a number', value: 5, expectedType: 'number' },
    { label: 'a boolean', value: true, expectedType: 'boolean' },
    { label: 'an object', value: {}, expectedType: 'object' },
    { label: 'an array', value: [], expectedType: 'object' },
    { label: 'a URL', value: new URL('http://localhost:3000'), expectedType: 'object' },
  ];

  it.each(invalidBaseURLs)(
    'should throw an error if provided a base URL that is not a string ($label)',
    async ({ value, expectedType }) => {
      const handler = vi.fn();

      // @ts-expect-error Forcing an invalid base URL type.
      const invalidBaseURL: string = value;

      await expect(async () => {
        await usingHttpInterceptor({ ...interceptorOptions, baseURL: invalidBaseURL }, handler);
      }).rejects.toThrow(new ValidationError(`Expected options.baseURL to be string, but got ${expectedType}.`));

      expect(handler).not.toHaveBeenCalled();
    },
  );

  if (type === 'local') {
    it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
      'should not throw an error if provided a supported base URL protocol (%s)',
      async (supportedProtocol) => {
        const url = `${supportedProtocol}://localhost:3000`;
        const handler = vi.fn();

        const interceptorPromise = usingHttpInterceptor({ ...interceptorOptions, baseURL: url }, handler);
        await expect(interceptorPromise).resolves.not.toThrow();

        expect(handler).toHaveBeenCalledTimes(1);
      },
    );

    const exampleUnsupportedProtocols = ['ws', 'wss', 'ftp'];

    it.each(exampleUnsupportedProtocols)(
      'should throw an error if provided an unsupported base URL protocol (%s)',
      async (unsupportedProtocol) => {
        expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

        const url = `${unsupportedProtocol}://localhost:3000`;
        const handler = vi.fn();

        const interceptorPromise = usingHttpInterceptor({ ...interceptorOptions, baseURL: url }, handler);
        await expect(interceptorPromise).rejects.toThrow(
          new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS),
        );

        expect(handler).not.toHaveBeenCalled();
      },
    );
  }
}
