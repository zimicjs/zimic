import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import InvalidFormDataError from '@/http/errors/InvalidFormDataError';
import HttpFormData from '@/http/formData/HttpFormData';
import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HTTP_METHODS, HTTP_METHODS_WITH_REQUEST_BODY, HttpSchema } from '@/http/types/schema';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import LocalHttpRequestHandler from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/interceptor/server/constants';
import { importFile } from '@/utils/files';
import { joinURL } from '@/utils/urls';
import { usingIgnoredConsole } from '@tests/utils/console';
import { expectFetchError, expectFetchErrorOrPreflightResponse } from '@tests/utils/fetch';
import { assessPreflightInterference, usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorOptions } from '../../types/options';
import { RuntimeSharedHttpInterceptorTestsOptions } from './utils';

export async function declareRestrictionsHttpInterceptorTests(options: RuntimeSharedHttpInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  const File = await importFile();

  let baseURL: URL;
  let interceptorOptions: HttpInterceptorOptions;

  let Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();

    Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;
  });

  interface RequestHeadersSchema {
    'content-language': string;
    accept: string;
    optional?: string;
  }

  interface RequestSearchParamsSchema {
    tag: string;
    other: string;
    optional?: string;
  }

  interface RequestJSONSchema {
    message: string;
    required: string;
    optional?: string;
  }

  interface RequestFormDataSchema {
    tag: File;
  }

  type MethodSchema = HttpSchema.Method<{
    request: {
      headers: RequestHeadersSchema;
      searchParams: RequestSearchParamsSchema;
    };
    response: {
      200: { headers: AccessControlHeaders };
    };
  }>;

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { overridesPreflightResponse, numberOfRequestsIncludingPreflight } = assessPreflightInterference({
      method,
      platform,
      type,
    });

    const lowerMethod = method.toLowerCase<'POST'>();

    it(`should support intercepting ${method} requests having partial headers restrictions`, async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
          HEAD: MethodSchema;
          OPTIONS: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              headers: { 'content-language': 'en' },
            })
            .with({
              headers: new HttpHeaders<Partial<RequestHeadersSchema>>({ 'content-language': 'en' }),
            })
            .with({
              headers: new HttpHeaders<HttpSchema.Headers<RequestHeadersSchema>>(),
            })
            .with((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HttpSchema.Headers<RequestHeadersSchema>>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              const acceptHeader = request.headers.get('accept');
              return acceptHeader ? acceptHeader.includes('application/json') : false;
            })
            .respond((request) => {
              expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HttpSchema.Headers<RequestHeadersSchema>>>();
              expect(request.headers).toBeInstanceOf(HttpHeaders);

              return {
                status: 200,
                headers: DEFAULT_ACCESS_CONTROL_HEADERS,
              };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const headers = new HttpHeaders<HttpSchema.Headers<RequestHeadersSchema>>({
          'content-language': 'en',
          accept: 'application/json',
        });

        let response = await fetch(joinURL(baseURL, '/users'), { method, headers });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        headers.append('accept', 'application/xml');

        response = await fetch(joinURL(baseURL, '/users'), { method, headers });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.delete('accept');

        let promise = fetch(joinURL(baseURL, '/users'), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.delete('content-language');

        promise = fetch(joinURL(baseURL, '/users'), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        headers.set('accept', 'application/json');
        headers.set('content-language', 'pt');

        promise = fetch(joinURL(baseURL, `/users`), { method, headers });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);
      });
    });

    it(`should support intercepting ${method} requests having partial search params restrictions`, async () => {
      await usingHttpInterceptor<{
        '/users': {
          GET: MethodSchema;
          POST: MethodSchema;
          PUT: MethodSchema;
          PATCH: MethodSchema;
          DELETE: MethodSchema;
          HEAD: MethodSchema;
          OPTIONS: MethodSchema;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              searchParams: { tag: 'admin' },
            })
            .with({
              searchParams: new HttpSearchParams<Partial<RequestSearchParamsSchema>>({
                tag: 'admin',
              }),
            })
            .with({
              searchParams: new HttpSearchParams<HttpSchema.SearchParams<RequestSearchParamsSchema>>(),
            })
            .respond((request) => {
              expectTypeOf(request.searchParams).toEqualTypeOf<
                HttpSearchParams<HttpSchema.SearchParams<RequestSearchParamsSchema>>
              >();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return {
                status: 200,
                headers: DEFAULT_ACCESS_CONTROL_HEADERS,
              };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const searchParams = new HttpSearchParams<HttpSchema.SearchParams<RequestSearchParamsSchema>>({
          tag: 'admin',
          other: 'value',
        });

        const response = await fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
          method,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);

        searchParams.delete('tag');

        const promise = fetch(joinURL(baseURL, `/users?${searchParams.toString()}`), {
          method,
        });
        await expectFetchErrorOrPreflightResponse(promise, {
          shouldBePreflight: overridesPreflightResponse,
        });
        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(numberOfRequestsIncludingPreflight);
      });
    });
  });

  describe.each(HTTP_METHODS_WITH_REQUEST_BODY)('Method (%s)', (method) => {
    const lowerMethod = method.toLowerCase<'POST'>();

    it(`should support intercepting ${method} requests having partial, exact body JSON restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: RequestJSONSchema };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: { message: 'ok' },
              exact: true,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<RequestJSONSchema>();
              expect(request.body).toEqual({ message: 'ok' });

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'ok' }),
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        for (const body of [JSON.stringify({ message: 'other' }), JSON.stringify({}), undefined]) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: body ? { 'content-type': 'application/json' } : undefined,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
        }
      });
    });

    it(`should support intercepting ${method} requests having partial, non-exact body JSON restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: RequestJSONSchema };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: { message: 'ok' },
              exact: false,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<RequestJSONSchema>();
              expect(request.body).toEqual(expect.objectContaining({ message: 'ok' }));

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'ok' }),
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'ok', other: 'other' }),
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        for (const body of [JSON.stringify({ message: 'other' }), JSON.stringify({}), undefined]) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            headers: body ? { 'content-type': 'application/json' } : undefined,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(2);
        }
      });
    });

    it(`should support intercepting ${method} requests having partial, exact body form data restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: HttpFormData<HttpSchema.FormData<RequestFormDataSchema>> };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        const tagFile = new File(['content'], 'tag.txt', { type: 'text/plain' });
        restrictedFormData.append('tag', tagFile);

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: restrictedFormData,
              exact: true,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>>();
              expect(request.body).toEqual(restrictedFormData);

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedFormData,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        const differentTagFile = new File(['more-content'], 'tag.txt', { type: 'text/plain' });

        const extendedFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        extendedFormData.append('tag', tagFile);
        extendedFormData.append('tag', differentTagFile);

        const differentFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        differentFormData.append('tag', differentTagFile);

        for (const body of [
          extendedFormData,
          differentFormData,
          new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>(),
          undefined,
        ]) {
          await usingIgnoredConsole(['error'], async (spies) => {
            const promise = fetch(joinURL(baseURL, '/users'), {
              method,
              body,
            });
            await expectFetchError(promise);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(1);

            if (body && !body.has('tag') && platform === 'browser') {
              expect(spies.error).toHaveBeenCalledTimes(1);
              expect(spies.error).toHaveBeenCalledWith(expect.any(InvalidFormDataError));
            } else {
              expect(spies.error).toHaveBeenCalledTimes(0);
            }
          });
        }
      });
    });

    it(`should support intercepting ${method} requests having partial, non-exact body form data restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: HttpFormData<HttpSchema.FormData<RequestFormDataSchema>> };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        const tagFile = new File(['content'], 'tag.txt', { type: 'text/plain' });
        restrictedFormData.append('tag', tagFile);

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: restrictedFormData,
              exact: false,
            })
            .with({
              body: new HttpFormData<Partial<RequestFormDataSchema>>(),
              exact: false,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>>();
              expect(request.body.has('tag')).toBe(true);

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedFormData,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        const differentTagFile = new File(['other'], 'tag.txt', { type: 'text/plain' });

        const extendedFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        extendedFormData.append('tag', tagFile);
        extendedFormData.append('tag', differentTagFile);

        response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: extendedFormData,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        const differentFormData = new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>();
        differentFormData.append('tag', differentTagFile);

        for (const body of [
          differentFormData,
          new HttpFormData<HttpSchema.FormData<RequestFormDataSchema>>(),
          undefined,
        ]) {
          await usingIgnoredConsole(['error'], async (spies) => {
            const promise = fetch(joinURL(baseURL, '/users'), {
              method,
              body,
            });
            await expectFetchError(promise);

            requests = await promiseIfRemote(handler.requests(), interceptor);
            expect(requests).toHaveLength(2);

            if (body && !body.has('tag') && platform === 'browser') {
              expect(spies.error).toHaveBeenCalledTimes(1);
              expect(spies.error).toHaveBeenCalledWith(expect.any(InvalidFormDataError));
            } else {
              expect(spies.error).toHaveBeenCalledTimes(0);
            }
          });
        }
      });
    });

    it(`should support intercepting ${method} requests having partial, exact body search params restrictions`, async () => {
      type SearchParamsSchema = HttpSchema.SearchParams<{
        tag: string;
        other?: string;
      }>;

      type MethodSchema = HttpSchema.Method<{
        request: { body: HttpSearchParams<SearchParamsSchema> };
        response: { 200: { body: HttpSearchParams<SearchParamsSchema> } };
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
          interceptor[lowerMethod]('/users')
            .with({
              body: restrictedSearchParams,
              exact: true,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
              expect(request.body).toEqual(restrictedSearchParams);

              return { status: 200, body: request.body };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedSearchParams,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        for (const body of [
          new HttpSearchParams<SearchParamsSchema>({ tag: 'admin', other: 'other' }),
          new HttpSearchParams<SearchParamsSchema>({ tag: 'other' }),
          new HttpSearchParams<SearchParamsSchema>(),
          undefined,
        ]) {
          const promise = fetch(joinURL(baseURL, `/users?tag=admin`), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
        }
      });
    });

    it(`should support intercepting ${method} requests having partial, non-exact body search params restrictions`, async () => {
      type SearchParamsSchema = HttpSchema.SearchParams<{
        tag: string;
        other?: string;
      }>;

      type MethodSchema = HttpSchema.Method<{
        request: { body: HttpSearchParams<SearchParamsSchema> };
        response: { 200: { body: HttpSearchParams<SearchParamsSchema> } };
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
          interceptor[lowerMethod]('/users')
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

              return { status: 200, body: request.body };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedSearchParams,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: new HttpSearchParams<SearchParamsSchema>({ tag: 'admin', other: 'other' }),
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        for (const body of [
          new HttpSearchParams<SearchParamsSchema>({ tag: 'other' }),
          new HttpSearchParams<SearchParamsSchema>(),
          undefined,
        ]) {
          const promise = fetch(joinURL(baseURL, `/users?tag=admin`), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(2);
        }
      });
    });

    it(`should support intercepting ${method} requests having exact body text restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: string };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedBody = 'content';

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: restrictedBody,
              exact: true,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<string>();
              expect(request.body).toBe(restrictedBody);

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedBody,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        for (const body of ['more-content', 'cont', '']) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
        }
      });
    });

    it(`should support intercepting ${method} requests having non-exact body text restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: string };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedBody = 'content';

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
            .with({
              body: restrictedBody,
              exact: false,
            })
            .respond((request) => {
              expectTypeOf(request.body).toEqualTypeOf<string>();
              expect(request.body).toContain(restrictedBody);

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: restrictedBody,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        response = await fetch(joinURL(baseURL, '/users'), {
          method,
          body: 'more-content',
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        for (const body of ['cont', '']) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(2);
        }
      });
    });

    it(`should support intercepting ${method} requests having exact body blob restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: Blob };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedBody = new File(['content'], 'file.bin', { type: 'application/octet-stream' });

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
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

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        const response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: restrictedBody,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        for (const body of [
          new File(['more-content'], 'file.bin', { type: 'application/octet-stream' }),
          new File(['content'], 'file.bin', { type: 'text/plain' }),
          new File(['cont'], 'file.bin', { type: 'application/octet-stream' }),
          new File([], 'file.bin', { type: 'application/octet-stream' }),
          new File([], ''),
        ]) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(1);
        }
      });
    });

    it(`should support intercepting ${method} requests having non-exact body blob restrictions`, async () => {
      type MethodSchemaWithBody = HttpSchema.Method<{
        request: { body: Blob };
        response: { 200: {} };
      }>;

      await usingHttpInterceptor<{
        '/users': {
          POST: MethodSchemaWithBody;
          PUT: MethodSchemaWithBody;
          PATCH: MethodSchemaWithBody;
          DELETE: MethodSchemaWithBody;
        };
      }>(interceptorOptions, async (interceptor) => {
        const restrictedBody = new File(['content'], 'file.bin', { type: 'application/octet-stream' });

        const handler = await promiseIfRemote(
          interceptor[lowerMethod]('/users')
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

              return { status: 200 };
            }),
          interceptor,
        );
        expect(handler).toBeInstanceOf(Handler);

        let requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(0);

        let response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: restrictedBody,
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(1);

        response = await fetch(joinURL(baseURL, '/users'), {
          method,
          headers: { 'content-type': 'application/octet-stream' },
          body: new File(['more-content'], 'file.bin', { type: 'application/octet-stream' }),
        });
        expect(response.status).toBe(200);

        requests = await promiseIfRemote(handler.requests(), interceptor);
        expect(requests).toHaveLength(2);

        for (const body of [
          new File(['content'], 'file.bin', { type: 'text/plain' }),
          new File(['cont'], 'file.bin', { type: 'application/octet-stream' }),
          new File([], 'file.bin', { type: 'application/octet-stream' }),
          new File([], ''),
        ]) {
          const promise = fetch(joinURL(baseURL, '/users'), {
            method,
            body,
          });
          await expectFetchError(promise);

          requests = await promiseIfRemote(handler.requests(), interceptor);
          expect(requests).toHaveLength(2);
        }
      });
    });
  });
}
