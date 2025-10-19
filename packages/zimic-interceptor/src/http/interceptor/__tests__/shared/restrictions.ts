import { HttpSchema, HttpHeaders, HttpSearchParams, HttpFormData, InvalidFormDataError } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import joinURL from '@zimic/utils/url/joinURL';
import color from 'picocolors';
import { beforeEach, expect, expectTypeOf, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { importFile } from '@/utils/files';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declareRestrictionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

  const File = await importFile();

  let baseURL: string;
  let interceptorOptions: HttpInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  type RequestHeadersSchema = HttpSchema.Headers<{
    'content-language'?: string;
    count?: number;
    optional?: boolean;
  }>;

  type RequestSearchParamsSchema = HttpSchema.SearchParams<{
    tag: string;
    page: number;
    optional?: boolean;
  }>;

  interface RequestJSONSchema {
    message: string;
    required: string;
    optional?: string;
  }

  type RequestFormDataSchema = HttpSchema.FormData<{
    tag: File;
  }>;

  type MethodSchema = HttpSchema.Method<{
    request: {
      headers: RequestHeadersSchema;
      searchParams: RequestSearchParamsSchema;
    };
    response: {
      204: { headers: AccessControlHeaders };
    };
  }>;

  it('should support intercepting requests having partial headers restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({
            headers: { count: 1 },
          })
          .with({
            headers: new HttpHeaders<Partial<RequestHeadersSchema>>({ optional: false }),
          })
          .with({
            headers: new HttpHeaders<RequestHeadersSchema>(),
          })
          .with((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<RequestHeadersSchema>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            const contentLanguage = request.headers.get('content-language');
            expectTypeOf(contentLanguage).toEqualTypeOf<string | null>();
            return contentLanguage?.includes('en') ?? false;
          })
          .respond((request) => {
            expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<RequestHeadersSchema>>();
            expect(request.headers).toBeInstanceOf(HttpHeaders);

            return {
              status: 204,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const headers = new HttpHeaders<RequestHeadersSchema>({
        'content-language': 'en',
        count: 1,
        optional: false,
      });

      let response = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      headers.append('content-language', 'pt');

      response = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      headers.delete('content-language');

      let responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(2);

      headers.delete('count');

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(2);

      headers.set('count', 1);
      headers.set('content-language', 'pt');

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(2);

      headers.set('count', 2);
      headers.set('content-language', 'en');

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(2);

      headers.set('count', 1);
      headers.set('optional', true);

      responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(2);

      headers.set('optional', false);

      response = await fetch(joinURL(baseURL, '/users'), { method: 'GET', headers });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(3);
    });
  });

  it('should support intercepting requests having partial search params restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': { GET: MethodSchema };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .get('/users')
          .with({
            searchParams: { tag: 'admin', page: 1 },
          })
          .with({
            searchParams: new HttpSearchParams<Partial<RequestSearchParamsSchema>>({ optional: false }),
          })
          .with({
            searchParams: new HttpSearchParams<RequestSearchParamsSchema>(),
          })
          .respond((request) => {
            expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<RequestSearchParamsSchema>>();
            expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

            return {
              status: 204,
              headers: DEFAULT_ACCESS_CONTROL_HEADERS,
            };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const searchParams = new HttpSearchParams<RequestSearchParamsSchema>({
        tag: 'admin',
        page: 1,
        optional: false,
      });

      let response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      searchParams.delete('tag');

      let responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(1);

      searchParams.set('tag', 'admin');
      searchParams.set('page', 2);

      responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(1);

      searchParams.set('page', 1);
      searchParams.set('optional', true);

      responsePromise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      await expectFetchError(responsePromise);

      expect(handler.requests).toHaveLength(1);

      searchParams.set('optional', false);

      response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), { method: 'GET' });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);
    });
  });

  it('should support intercepting requests having exact body JSON restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: RequestJSONSchema };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: { message: 'ok' },
            exact: true,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<RequestJSONSchema>();
            expect(request.body).toEqual({ message: 'ok' });

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'ok' }),
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      for (const body of [JSON.stringify({ message: 'other' }), JSON.stringify({}), undefined]) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);
      }
    });
  });

  it('should support intercepting requests having non-exact body JSON restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: RequestJSONSchema };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: { message: 'ok' },
            exact: false,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<RequestJSONSchema>();
            expect(request.body).toEqual(expect.objectContaining({ message: 'ok' }));

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'ok' }),
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'ok', other: 'other' }),
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      for (const body of [JSON.stringify({ message: 'other' }), JSON.stringify({}), undefined]) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(2);
      }
    });
  });

  it('should support intercepting requests having exact body form data restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: HttpFormData<RequestFormDataSchema> };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedFormData = new HttpFormData<RequestFormDataSchema>();
      const tagFile = new File(['content'], 'tag.txt', { type: 'text/plain' });
      restrictedFormData.append('tag', tagFile);

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedFormData,
            exact: true,
          })
          .respond(async (request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpFormData<RequestFormDataSchema>>();

            const receivedTagFile = request.body.get('tag');
            expect(receivedTagFile.name).toBe(tagFile.name);
            expect(receivedTagFile.type).toBe(tagFile.type);
            expect(receivedTagFile.size).toBe(tagFile.size);
            expect(await receivedTagFile.arrayBuffer()).toEqual(await tagFile.arrayBuffer());

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedFormData,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const differentTagFile = new File(['more-content'], 'tag.txt', { type: 'text/plain' });

      const extendedFormData = new HttpFormData<RequestFormDataSchema>();
      extendedFormData.append('tag', tagFile);
      extendedFormData.append('tag', differentTagFile);

      const differentFormData = new HttpFormData<RequestFormDataSchema>();
      differentFormData.append('tag', differentTagFile);

      for (const body of [extendedFormData, differentFormData, new HttpFormData<RequestFormDataSchema>(), undefined]) {
        await usingIgnoredConsole(['error'], async (console) => {
          const responsePromise = fetch(joinURL(baseURL, '/users'), {
            method: 'POST',
            body,
          });

          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(1);

          if (body && !body.has('tag') && platform === 'browser') {
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse request body:',
              expect.any(InvalidFormDataError),
            );
          } else {
            expect(console.error).toHaveBeenCalledTimes(0);
          }
        });
      }
    });
  });

  it('should support intercepting requests having non-exact body form data restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: HttpFormData<RequestFormDataSchema> };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedFormData = new HttpFormData<RequestFormDataSchema>();
      const tagFile = new File(['content'], 'tag.txt', { type: 'text/plain' });
      restrictedFormData.append('tag', tagFile);

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedFormData,
            exact: false,
          })
          .with({
            body: new HttpFormData<Partial<RequestFormDataSchema>>(),
            exact: false,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpFormData<RequestFormDataSchema>>();
            expect(request.body.has('tag')).toBe(true);

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedFormData,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      const differentTagFile = new File(['other'], 'tag.txt', { type: 'text/plain' });

      const extendedFormData = new HttpFormData<RequestFormDataSchema>();
      extendedFormData.append('tag', tagFile);
      extendedFormData.append('tag', differentTagFile);

      const differentFormData = new HttpFormData<RequestFormDataSchema>();
      differentFormData.append('tag', differentTagFile);

      for (const body of [extendedFormData, differentFormData, new HttpFormData<RequestFormDataSchema>(), undefined]) {
        await usingIgnoredConsole(['error'], async (console) => {
          const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', body });
          await expectFetchError(responsePromise);

          expect(handler.requests).toHaveLength(1);

          if (body && !body.has('tag') && platform === 'browser') {
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(
              color.cyan('[@zimic/interceptor]'),
              'Failed to parse request body:',
              expect.any(InvalidFormDataError),
            );
          } else {
            expect(console.error).toHaveBeenCalledTimes(0);
          }
        });
      }
    });
  });

  it('should support intercepting requests having exact body search params restrictions', async () => {
    type SearchParamsSchema = HttpSchema.SearchParams<{
      tag: string;
      other?: string;
    }>;

    type MethodSchema = HttpSchema.Method<{
      request: { body: HttpSearchParams<SearchParamsSchema> };
      response: { 204: { body: HttpSearchParams<SearchParamsSchema> } };
    }>;

    await usingHttpInterceptor<{
      '/users': {
        POST: MethodSchema;
        PUT: MethodSchema;
        PATCH: MethodSchema;
        DELETE: MethodSchema;
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedSearchParams = new HttpSearchParams<SearchParamsSchema>({ tag: 'admin' });

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedSearchParams,
            exact: true,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
            expect(request.body).toEqual(restrictedSearchParams);

            return { status: 204, body: request.body };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedSearchParams,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      for (const body of [
        new HttpSearchParams<SearchParamsSchema>({ tag: 'admin', other: 'other' }),
        new HttpSearchParams<SearchParamsSchema>({ tag: 'other' }),
        new HttpSearchParams<SearchParamsSchema>(),
        undefined,
      ]) {
        const responsePromise = fetch(joinURL(baseURL, '/users?tag=admin'), {
          method: 'POST',
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);
      }
    });
  });

  it('should support intercepting requests having non-exact body search params restrictions', async () => {
    type SearchParamsSchema = HttpSchema.SearchParams<{
      tag: string;
      other?: string;
    }>;

    type MethodSchema = HttpSchema.Method<{
      request: { body: HttpSearchParams<SearchParamsSchema> };
      response: { 204: { body: HttpSearchParams<SearchParamsSchema> } };
    }>;

    await usingHttpInterceptor<{
      '/users': {
        POST: MethodSchema;
        PUT: MethodSchema;
        PATCH: MethodSchema;
        DELETE: MethodSchema;
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedSearchParams = new HttpSearchParams<SearchParamsSchema>({ tag: 'admin' });

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedSearchParams,
            exact: false,
          })
          .with({
            body: new HttpSearchParams<Partial<SearchParamsSchema>>(),
            exact: false,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
            expect(request.body.has('tag')).toBe(true);

            return { status: 204, body: request.body };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedSearchParams,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: new HttpSearchParams<SearchParamsSchema>({ tag: 'admin', other: 'other' }),
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      for (const body of [
        new HttpSearchParams<SearchParamsSchema>({ tag: 'other' }),
        new HttpSearchParams<SearchParamsSchema>(),
        undefined,
      ]) {
        const responsePromise = fetch(joinURL(baseURL, '/users?tag=admin'), {
          method: 'POST',
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(2);
      }
    });
  });

  it('should support intercepting requests having exact body text restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: string };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedBody = 'content';

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedBody,
            exact: true,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<string>();
            expect(request.body).toBe(restrictedBody);

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedBody,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      for (const body of ['more-content', 'cont', '']) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);
      }
    });
  });

  it('should support intercepting requests having non-exact body text restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: string };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedBody = 'content';

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedBody,
            exact: false,
          })
          .respond((request) => {
            expectTypeOf(request.body).toEqualTypeOf<string>();
            expect(request.body).toContain(restrictedBody);

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      let response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: restrictedBody,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        body: 'more-content',
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(2);

      for (const body of ['cont', '']) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(2);
      }
    });
  });

  it('should support intercepting requests having exact body blob restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: Blob };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedBody = new File(['content'], 'file.bin', { type: 'application/octet-stream' });

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedBody,
            exact: true,
          })
          .respond(async (request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.type).toBe(restrictedBody.type);
            expect(request.body.size).toBe(restrictedBody.size);
            expect(await request.body.text()).toEqual(await restrictedBody.text());

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: restrictedBody,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      for (const body of [
        new File(['more-content'], 'file.bin', { type: 'application/octet-stream' }),
        new File(['content'], 'file.bin', { type: 'text/plain' }),
        new File(['cont'], 'file.bin', { type: 'application/octet-stream' }),
        new File([], 'file.bin', { type: 'application/octet-stream' }),
        new File([], ''),
      ]) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), {
          method: 'POST',
          body,
        });

        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);
      }
    });
  });

  it('should support intercepting requests having non-exact body blob restrictions', async () => {
    await usingHttpInterceptor<{
      '/users': {
        POST: {
          request: { body: Blob };
          response: { 204: {} };
        };
      };
    }>(interceptorOptions, async (interceptor) => {
      const restrictedBody = new File(['content'], 'file.bin', { type: 'application/octet-stream' });

      const handler = await promiseIfRemote(
        interceptor
          .post('/users')
          .with({
            body: restrictedBody,
            exact: false,
          })
          .respond(async (request) => {
            expectTypeOf(request.body).toEqualTypeOf<Blob>();
            expect(request.body).toBeInstanceOf(Blob);
            expect(request.body.type).toBe(restrictedBody.type);
            expect(request.body.size).toBeGreaterThanOrEqual(restrictedBody.size);
            expect(await request.body.text()).toContain(await restrictedBody.text());

            return { status: 204 };
          }),
        interceptor,
      );

      expect(handler.requests).toHaveLength(0);

      const response = await fetch(joinURL(baseURL, '/users'), {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: restrictedBody,
      });
      expect(response.status).toBe(204);

      expect(handler.requests).toHaveLength(1);

      for (const body of [
        new File(['more-content'], 'file.bin', { type: 'text/plain' }),
        new File(['content'], 'file.bin', { type: 'text/plain' }),
        new File(['cont'], 'file.bin', { type: 'application/octet-stream' }),
        new File([], 'file.bin', { type: 'application/octet-stream' }),
        new File([], ''),
      ]) {
        const responsePromise = fetch(joinURL(baseURL, '/users'), { method: 'POST', body });
        await expectFetchError(responsePromise);

        expect(handler.requests).toHaveLength(1);
      }
    });
  });
}
