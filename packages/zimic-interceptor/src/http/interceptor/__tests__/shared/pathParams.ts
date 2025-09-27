import { HttpSchema } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { importCrypto } from '@/utils/crypto';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declarePathParamsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  const crypto = await importCrypto();

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type MethodSchema = HttpSchema.Method<{
    response: { 204: {} };
  }>;

  it('should support generic and specific handlers when intercepting requests with path parameters', async () => {
    interface PathParams {
      userId: string;
    }

    await usingHttpInterceptor<{
      '/users/:userId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const genericHandler = await promiseIfRemote(
        interceptor.get('/users/:userId').respond({ status: 204 }),
        interceptor,
      );
      expect(genericHandler).toBeInstanceOf(Handler);

      expect(genericHandler.requests).toHaveLength(0);

      const genericResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(genericResponse.status).toBe(204);

      expect(genericHandler.requests).toHaveLength(1);
      const genericRequest = genericHandler.requests[0];
      expect(genericRequest).toBeInstanceOf(Request);

      expectTypeOf(genericRequest.pathParams).toEqualTypeOf<PathParams>();
      expect(genericRequest.pathParams).toEqual({ userId: users[0].id });

      expectTypeOf(genericRequest.body).toEqualTypeOf<null>();
      expect(genericRequest.body).toBe(null);

      expectTypeOf(genericRequest.response.status).toEqualTypeOf<204>();
      expect(genericRequest.response.status).toBe(204);

      expectTypeOf(genericRequest.response.body).toEqualTypeOf<null>();
      expect(genericRequest.response.body).toBe(null);

      await promiseIfRemote(genericHandler.clear(), interceptor);

      const specificHandler = await promiseIfRemote(
        interceptor.get(`/users/${users[0].id}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<Partial<PathParams>>({});

          return { status: 204 };
        }),
        interceptor,
      );
      expect(specificHandler).toBeInstanceOf(Handler);

      expect(specificHandler.requests).toHaveLength(0);

      const specificResponse = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(specificResponse.status).toBe(204);

      expect(specificHandler.requests).toHaveLength(1);
      const specificRequest = specificHandler.requests[0];
      expect(specificRequest).toBeInstanceOf(Request);

      expectTypeOf(specificRequest.pathParams).toEqualTypeOf<PathParams>();
      expect(specificRequest.pathParams).toEqual({});

      expectTypeOf(specificRequest.body).toEqualTypeOf<null>();
      expect(specificRequest.body).toBe(null);

      expectTypeOf(specificRequest.response.status).toEqualTypeOf<204>();
      expect(specificRequest.response.status).toBe(204);

      expectTypeOf(specificRequest.response.body).toEqualTypeOf<null>();
      expect(specificRequest.response.body).toBe(null);

      const unmatchedResponsePromise = fetch(joinURL(baseURL, '/users/2'), { method: 'GET' });
      await expectFetchError(unmatchedResponsePromise);
    });
  });

  it('should correctly intercept requests with no path params', async () => {
    await usingHttpInterceptor<{
      '/users/other': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users/other').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
          expect(request.pathParams).toEqual({});

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users/other'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
      expect(request.pathParams).toEqual({});
    });
  });

  it('should correctly intercept requests with one required path param', async () => {
    interface PathParams {
      userId: string;
    }

    await usingHttpInterceptor<{
      '/users/:userId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });
    });
  });

  it('should correctly intercept requests with one optional path param', async () => {
    interface PathParams {
      userId?: string;
    }

    await usingHttpInterceptor<{
      '/users/:userId?': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId?').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf<PathParams>([{ userId: users[0].id }, { userId: undefined }]),
          );

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

      response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({});
    });
  });

  it('should correctly intercept requests with one repeating required path param', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingHttpInterceptor<{
      '/files/:filePath+': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/files/:filePath+').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/files/path/to/file'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });
    });
  });

  it('should correctly intercept requests with one repeating optional path param', async () => {
    interface PathParams {
      filePath?: string;
    }

    await usingHttpInterceptor<{
      '/files/:filePath*': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/files/:filePath*').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf<PathParams>([{ filePath: 'path/to/file' }, { filePath: undefined }]),
          );

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/files/path/to/file'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });

      response = await fetch(joinURL(baseURL, '/files'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({});
    });
  });

  it('should correctly intercept requests with multiple required path params', async () => {
    interface PathParams {
      userId: string;
      postId: string;
    }

    await usingHttpInterceptor<{
      '/users/:userId/posts/:postId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const postId = crypto.randomUUID();

      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId/posts/:postId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, `/users/${users[0].id}/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });
    });
  });

  it('should correctly intercept requests with multiple optional path params', async () => {
    interface PathParams {
      userId?: string;
      postId?: string;
    }

    await usingHttpInterceptor<{
      '/users/:userId?/posts/:postId?': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const postId = crypto.randomUUID();

      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId?/posts/:postId?').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf<PathParams>([{ userId: users[0].id, postId }, { userId: users[0].id }, { postId }, {}]),
          );

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/users/${users[0].id}/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

      response = await fetch(joinURL(baseURL, `/users/${users[0].id}/posts`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

      response = await fetch(joinURL(baseURL, `/users/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);

      request = handler.requests[2];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ postId });

      response = await fetch(joinURL(baseURL, '/users/posts'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(4);

      request = handler.requests[3];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({});
    });
  });

  it('should correctly intercept requests with multiple repeating required path params', async () => {
    interface PathParams {
      path1: string;
      path2: string;
    }

    await usingHttpInterceptor<{
      '/level1/:path1+/level2/:path2+': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/level1/:path1+/level2/:path2+').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/level1/path/other/level2/path'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });
    });
  });

  it('should correctly intercept requests with multiple repeating optional path params', async () => {
    interface PathParams {
      path1?: string;
      path2?: string;
    }

    await usingHttpInterceptor<{
      '/level1/:path1*/level2/:path2*': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/level1/:path1*/level2/:path2*').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf<PathParams>([
              { path1: 'path/other', path2: 'path' },
              { path1: 'path/other' },
              { path2: 'path' },
              {},
            ]),
          );

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/level1/path/other/level2/path'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });

      response = await fetch(joinURL(baseURL, '/level1/path/other/level2'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other' });

      response = await fetch(joinURL(baseURL, '/level1/level2/path'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);

      request = handler.requests[2];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ path2: 'path' });

      response = await fetch(joinURL(baseURL, '/level1/level2'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(4);

      request = handler.requests[3];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({});
    });
  });

  it('should correctly intercept requests with mixed path params', async () => {
    interface PathParams {
      filePath?: string;
      userId?: string;
      postId: string;
    }

    await usingHttpInterceptor<{
      '/files/:filePath*/users/:userId?/posts/:postId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const filePath = 'path/to/file';
      const postId = crypto.randomUUID();

      const handler = await promiseIfRemote(
        interceptor.get('/files/:filePath*/users/:userId?/posts/:postId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf<PathParams>([
              { filePath, userId: users[0].id, postId },
              { filePath, postId },
              { userId: users[0].id, postId },
              { postId },
            ]),
          );

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/files/${filePath}/users/${users[0].id}/posts/${postId}`), {
        method: 'GET',
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath, userId: users[0].id, postId });

      response = await fetch(joinURL(baseURL, `/files/${filePath}/users/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath, postId });

      response = await fetch(joinURL(baseURL, `/files/users/${users[0].id}/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);

      request = handler.requests[2];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

      response = await fetch(joinURL(baseURL, `/files/users/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(4);

      request = handler.requests[3];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ postId });
    });
  });

  it('should correctly intercept requests with URI-encoded path params without slashes', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingHttpInterceptor<{
      '/files/:filePath': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const decodedFilePath = 'with spaces and áççéñtš';
      expect(decodedFilePath).not.toContain('/');

      const encodedFilePath = encodeURIComponent(decodedFilePath);
      expect(encodedFilePath).not.toBe(decodedFilePath);
      expect(encodedFilePath).not.toContain('/');
      expect(encodedFilePath.length).toBeGreaterThan(decodedFilePath.length);

      let handler = await promiseIfRemote(
        interceptor.get('/files/:filePath').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      response = await fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

      await promiseIfRemote(handler.clear(), handler);

      handler = await promiseIfRemote(
        interceptor.get(`/files/${encodedFilePath}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<Partial<PathParams>>({});

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);
      response = await fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      response = await fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});

      await promiseIfRemote(handler.clear(), handler);

      handler = await promiseIfRemote(
        interceptor.get(`/files/${decodedFilePath}`).respond({ status: 204 }),
        interceptor,
      );

      response = await fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      response = await fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});

      await promiseIfRemote(handler.clear(), handler);
    });
  });

  it('should correctly intercept requests with URI-encoded path params with slashes', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingHttpInterceptor<{
      '/files/:filePath': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const decodedFilePath = ['path', 'with', 'slashes'].join('/');
      expect(decodedFilePath).toContain('/');

      const encodedFilePath = encodeURIComponent(decodedFilePath);
      expect(encodedFilePath).not.toBe(decodedFilePath);
      expect(encodedFilePath).not.toContain('/');
      expect(encodedFilePath.length).toBeGreaterThan(decodedFilePath.length);

      let handler = await promiseIfRemote(
        interceptor.get('/files/:filePath').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      let responsePromise = fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

      await promiseIfRemote(handler.clear(), handler);

      handler = await promiseIfRemote(
        interceptor.get(`/files/${encodedFilePath}`).respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
          expect(request.pathParams).toEqual<Partial<PathParams>>({});

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);
      response = await fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      responsePromise = fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(1);

      request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});

      await promiseIfRemote(handler.clear(), handler);

      handler = await promiseIfRemote(
        interceptor.get(`/files/${decodedFilePath}`).respond({ status: 204 }),
        interceptor,
      );

      responsePromise = fetch(joinURL(baseURL, `/files/${encodedFilePath}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      response = await fetch(joinURL(baseURL, `/files/${decodedFilePath}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
      expect(request.pathParams).toEqual<Partial<PathParams>>({});
    });
  });
}
