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

      expectTypeOf(genericRequest.pathParams).toEqualTypeOf<{ userId: string }>();
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
          expectTypeOf(request.pathParams).toEqualTypeOf<{ userId: string }>();
          expect(request.pathParams).toEqual({});

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

      expectTypeOf(specificRequest.pathParams).toEqualTypeOf<{ userId: string }>();
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
    await usingHttpInterceptor<{
      '/users/:userId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ userId: string }>();
          expect(request.pathParams).toEqual({ userId: users[0].id });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId: string }>();
      expect(request.pathParams).toEqual({ userId: users[0].id });
    });
  });

  it('should correctly intercept requests with one optional path param', async () => {
    await usingHttpInterceptor<{
      '/users/:userId?': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId?').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string }>();
          expect(request.pathParams).toEqual(expect.toBeOneOf([{ userId: users[0].id }, { userId: undefined }]));

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, `/users/${users[0].id}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string }>();
      expect(request.pathParams).toEqual({ userId: users[0].id });

      response = await fetch(joinURL(baseURL, '/users'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string }>();
      expect(request.pathParams).toEqual({});
    });
  });

  it('should correctly intercept requests with one repeating required path param', async () => {
    await usingHttpInterceptor<{
      '/files/:filePath+': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/files/:filePath+').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ filePath: string }>();
          expect(request.pathParams).toEqual({ filePath: 'path/to/file' });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/files/path/to/file'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ filePath: string }>();
      expect(request.pathParams).toEqual({ filePath: 'path/to/file' });
    });
  });

  it('should correctly intercept requests with one repeating optional path param', async () => {
    await usingHttpInterceptor<{
      '/files/:filePath*': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/files/:filePath*').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ filePath?: string }>();
          expect(request.pathParams).toEqual(expect.toBeOneOf([{ filePath: 'path/to/file' }, { filePath: undefined }]));

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/files/path/to/file'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      let request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ filePath?: string }>();
      expect(request.pathParams).toEqual({ filePath: 'path/to/file' });

      response = await fetch(joinURL(baseURL, '/files'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ filePath?: string }>();
      expect(request.pathParams).toEqual({});
    });
  });

  it('should correctly intercept requests with multiple required path params', async () => {
    await usingHttpInterceptor<{
      '/users/:userId/posts/:postId': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const postId = crypto.randomUUID();

      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId/posts/:postId').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ userId: string; postId: string }>();
          expect(request.pathParams).toEqual({ userId: users[0].id, postId });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, `/users/${users[0].id}/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId: string; postId: string }>();
      expect(request.pathParams).toEqual({ userId: users[0].id, postId });
    });
  });

  it('should correctly intercept requests with multiple optional path params', async () => {
    await usingHttpInterceptor<{
      '/users/:userId?/posts/:postId?': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const postId = crypto.randomUUID();

      const handler = await promiseIfRemote(
        interceptor.get('/users/:userId?/posts/:postId?').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string; postId?: string }>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf([{ userId: users[0].id, postId }, { userId: users[0].id }, { postId }, {}]),
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
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string; postId?: string }>();
      expect(request.pathParams).toEqual({ userId: users[0].id, postId });

      response = await fetch(joinURL(baseURL, `/users/${users[0].id}/posts`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string; postId?: string }>();
      expect(request.pathParams).toEqual({ userId: users[0].id });

      response = await fetch(joinURL(baseURL, `/users/posts/${postId}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);

      request = handler.requests[2];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string; postId?: string }>();
      expect(request.pathParams).toEqual({ postId });

      response = await fetch(joinURL(baseURL, '/users/posts'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(4);

      request = handler.requests[3];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ userId?: string; postId?: string }>();
      expect(request.pathParams).toEqual({});
    });
  });

  it('should correctly intercept requests with multiple repeating required path params', async () => {
    await usingHttpInterceptor<{
      '/level1/:path1+/level2/:path2+': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/level1/:path1+/level2/:path2+').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ path1: string; path2: string }>();
          expect(request.pathParams).toEqual({ path1: 'path/other', path2: 'path' });

          return { status: 204 };
        }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/level1/path/other/level2/path'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const request = handler.requests[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ path1: string; path2: string }>();
      expect(request.pathParams).toEqual({ path1: 'path/other', path2: 'path' });
    });
  });

  it('should correctly intercept requests with multiple repeating optional path params', async () => {
    await usingHttpInterceptor<{
      '/level1/:path1*/level2/:path2*': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.get('/level1/:path1*/level2/:path2*').respond((request) => {
          expectTypeOf(request.pathParams).toEqualTypeOf<{ path1?: string; path2?: string }>();
          expect(request.pathParams).toEqual(
            expect.toBeOneOf([{ path1: 'path/other', path2: 'path' }, { path1: 'path/other' }, { path2: 'path' }, {}]),
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
      expectTypeOf(request.pathParams).toEqualTypeOf<{ path1?: string; path2?: string }>();
      expect(request.pathParams).toEqual({ path1: 'path/other', path2: 'path' });

      response = await fetch(joinURL(baseURL, '/level1/path/other/level2'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      request = handler.requests[1];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ path1?: string; path2?: string }>();
      expect(request.pathParams).toEqual({ path1: 'path/other' });

      response = await fetch(joinURL(baseURL, '/level1/level2/path'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);

      request = handler.requests[2];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ path1?: string; path2?: string }>();
      expect(request.pathParams).toEqual({ path2: 'path' });

      response = await fetch(joinURL(baseURL, '/level1/level2'), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(4);

      request = handler.requests[3];
      expectTypeOf(request.pathParams).toEqualTypeOf<{ path1?: string; path2?: string }>();
      expect(request.pathParams).toEqual({});
    });
  });
}
