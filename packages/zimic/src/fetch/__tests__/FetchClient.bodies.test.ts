import { describe, expect, expectTypeOf, it } from 'vitest';

import { HttpFormData, HttpSchema, HttpSearchParams, StrictFormData, StrictHeaders } from '@/http';
import { importFile } from '@/utils/files';
import { joinURL } from '@/utils/urls';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient (node) > Bodies', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  describe('JSON', () => {
    it('should support requests and responses with a JSON body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
            response: {
              201: { body: User };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .with({ body: users[0] })
          .respond({
            status: 201,
            body: users[0],
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(users[0]),
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(users[0]);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<User>>();
        expect(await response.request.json()).toEqual(users[0]);
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should support requests and responses with a number as a JSON body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: number;
            };
            response: {
              201: { body: number };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .with({ body: 1 })
          .respond({
            status: 201,
            body: 2,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(1),
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(2);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<number>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<number>>();
        expect(await response.request.json()).toEqual(1);
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should support requests and responses with a boolean as a JSON body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: boolean;
            };
            response: {
              201: { body: boolean };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .with({ body: false })
          .respond({
            status: 201,
            body: true,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(false),
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(true);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<boolean>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<boolean>>();
        expect(await response.request.json()).toEqual(false);
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider request with empty JSON bodies as null', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {};
            response: { 201: {} };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .with({ body: null })
          .respond({
            status: 201,
            body: null,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          body: null,
        });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(null);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        expect(await response.request.text()).toEqual('');
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  describe('Form data', () => {
    it('should support requests and responses with a form data body', async () => {
      type FormDataSchema = HttpSchema.FormData<{ title: string; file: File }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpFormData<FormDataSchema>;
            };
            response: {
              201: {
                body: HttpFormData<FormDataSchema>;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        const File = await importFile();

        const requestFormData = new HttpFormData<FormDataSchema>();
        requestFormData.append('title', 'request');
        requestFormData.append('file', new File(['request'], 'request.txt', { type: 'text/plain' }));

        const responseFormData = new HttpFormData<FormDataSchema>();
        responseFormData.append('title', 'response');
        responseFormData.append('file', new File(['response'], 'response.txt', { type: 'text/plain' }));

        await interceptor
          .post('/users')
          .with({ body: requestFormData })
          .respond({
            status: 201,
            body: responseFormData,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          body: requestFormData,
        });

        expect(response.status).toBe(201);
        const receivedResponseFormData = await response.formData();
        expect(Array.from(receivedResponseFormData.entries())).toHaveLength(2);

        expect(receivedResponseFormData.get('title')).toBe(responseFormData.get('title'));
        expect(receivedResponseFormData.get('file')).toEqual(responseFormData.get('file'));

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<StrictFormData<FormDataSchema>>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<StrictFormData<FormDataSchema>>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider requests and responses with empty form data bodies as form data', async () => {
      type FormDataSchema = HttpSchema.FormData<{ title: string; file: File }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'multipart/form-data' };
              body?: HttpFormData<FormDataSchema>;
            };
            response: {
              201: {
                headers: { 'content-type': 'multipart/form-data' };
                body?: HttpFormData<FormDataSchema>;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 201,
            headers: { 'content-type': 'multipart/form-data' },
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data' },
        });

        expect(response.status).toBe(201);
        expect(await response.text()).toBe('');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'multipart/form-data' }>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<StrictFormData<FormDataSchema> | FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<
          StrictHeaders<{ 'content-type': 'multipart/form-data' }>
        >();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<
          () => Promise<StrictFormData<FormDataSchema> | FormData>
        >();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  describe('Search params', () => {
    it('should support requests and responses with search params', async () => {
      type SearchParamsSchema = HttpSchema.SearchParams<{ title: string; descriptions: string[] }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpSearchParams<SearchParamsSchema>;
            };
            response: {
              201: {
                body: HttpSearchParams<SearchParamsSchema>;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        const requestSearchParams = new HttpSearchParams<SearchParamsSchema>({
          title: 'request',
          descriptions: ['description 1', 'description 2'],
        });

        const responseSearchParams = new HttpSearchParams<SearchParamsSchema>({
          title: 'response',
          descriptions: ['description 3', 'description 4'],
        });

        await interceptor
          .post('/users')
          .with({ body: requestSearchParams })
          .respond({
            status: 201,
            body: responseSearchParams,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          body: requestSearchParams,
        });

        expect(response.status).toBe(201);
        const receivedResponseSearchParams = await response.formData();
        expect(Array.from(receivedResponseSearchParams.entries())).toHaveLength(responseSearchParams.size);

        expect(receivedResponseSearchParams.get('title')).toBe(responseSearchParams.get('title'));
        expect(receivedResponseSearchParams.getAll('descriptions')).toEqual(
          responseSearchParams.getAll('descriptions'),
        );

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<StrictFormData<SearchParamsSchema>>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<StrictFormData<SearchParamsSchema>>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider requests and responses with empty search params as search params', async () => {
      type SearchParamsSchema = HttpSchema.SearchParams<{ title: string; descriptions: string[] }>;

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body?: HttpSearchParams<SearchParamsSchema>;
            };
            response: {
              201: {
                body?: HttpSearchParams<SearchParamsSchema>;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 201,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
        });

        expect(response.status).toBe(201);
        expect(await response.text()).toBe('');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<StrictFormData<SearchParamsSchema> | FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<
          () => Promise<StrictFormData<SearchParamsSchema> | FormData>
        >();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  describe('Plain text', () => {
    it('should support requests and responses with a plain text body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'text/plain' };
              body: 'request';
            };
            response: {
              201: { body: 'response' };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .with({ body: 'request' })
          .respond({
            status: 201,
            body: 'response',
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'request',
        });

        expect(response.status).toBe(201);
        expect(await response.text()).toBe('response');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<'response'>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'text/plain' }>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<'request'>>();
        expect(await response.request.text()).toBe('request');
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider requests and responses with empty plain text bodies as null', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'text/plain' };
              body?: 'request';
            };
            response: {
              201: { body?: 'response' };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 201,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
        });

        expect(response.status).toBe(201);
        expect(await response.text()).toBe('');

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'text/plain' }>>();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expect(await response.request.text()).toBe('');
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  describe('Blob', () => {
    it('should support requests and responses with a blob body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/octet-stream' };
              body: Blob;
            };
            response: {
              201: { body: Blob };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        const requestBlob = new Blob(['request'], { type: 'application/octet-stream' });
        const responseBlob = new Blob(['response'], { type: 'application/octet-stream' });

        await interceptor
          .post('/users')
          .with({ body: requestBlob })
          .respond({
            status: 201,
            body: responseBlob,
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: requestBlob,
        });

        expect(response.status).toBe(201);
        const receivedResponseBlob = await response.blob();
        expect(receivedResponseBlob.size).toBe(responseBlob.size);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<
          StrictHeaders<{ 'content-type': 'application/octet-stream' }>
        >();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await response.request.blob()).toEqual(requestBlob);
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider requests and responses with empty blob bodies as null', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/octet-stream' };
              body?: Blob;
            };
            response: {
              201: {
                headers: { 'content-type': 'application/octet-stream' };
                body?: Blob;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 201,
            headers: { 'content-type': 'application/octet-stream' },
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
        });

        expect(response.status).toBe(201);
        expect(await response.blob()).toEqual(new Blob([], { type: 'application/octet-stream' }));

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<
          StrictHeaders<{ 'content-type': 'application/octet-stream' }>
        >();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.blob).toEqualTypeOf<() => Promise<Blob>>();
        expect(await response.request.blob()).toEqual(new Blob([], { type: 'application/octet-stream' }));
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  describe('Array buffer', () => {
    it('should support requests and responses with an array buffer body', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/octet-stream' };
              body: ArrayBuffer;
            };
            response: {
              201: { body: ArrayBuffer };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        const requestArrayBuffer = new ArrayBuffer(2);
        const requestView = new Uint8Array(requestArrayBuffer);
        requestView[0] = 0xff;
        requestView[1] = 0x00;

        const responseBuffer = new ArrayBuffer(2);
        const responseView = new Uint8Array(responseBuffer);
        responseView[0] = 0x00;
        responseView[1] = 0xff;

        await interceptor
          .post('/users')
          .with({ body: new Blob([requestArrayBuffer], { type: 'application/octet-stream' }) })
          .respond({
            status: 201,
            body: new Blob([responseBuffer], { type: 'application/octet-stream' }),
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: requestArrayBuffer,
        });

        expect(response.status).toBe(201);
        expect(await response.arrayBuffer()).toEqual(responseBuffer);

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<never>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<never>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<
          StrictHeaders<{ 'content-type': 'application/octet-stream' }>
        >();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<never>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expect(await response.request.arrayBuffer()).toEqual(requestArrayBuffer);
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });

    it('should consider requests and responses with empty array buffer bodies as null', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/octet-stream' };
              body?: ArrayBuffer;
            };
            response: {
              201: {
                headers: { 'content-type': 'application/octet-stream' };
                body?: ArrayBuffer;
              };
            };
          };
        };
      }>;

      await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
        await interceptor
          .post('/users')
          .respond({
            status: 201,
            headers: { 'content-type': 'application/octet-stream' },
          })
          .times(1);

        const fetch = createFetch<Schema>({ baseURL });

        const response = await fetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
        });

        expect(response.status).toBe(201);
        expect(await response.arrayBuffer()).toEqual(new ArrayBuffer(0));

        expect(response).toBeInstanceOf(Response);
        expectTypeOf(response satisfies Response).toEqualTypeOf<
          FetchResponse<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.url).toBe(joinURL(baseURL, '/users'));

        expect(response.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/octet-stream' }>>();

        expectTypeOf(response.json).toEqualTypeOf<() => Promise<null>>();
        expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
        expectTypeOf(response.error).toEqualTypeOf<null>();

        expect(response.request).toBeInstanceOf(Request);
        expectTypeOf(response.request satisfies Request).toEqualTypeOf<
          FetchRequest<'/users', 'POST', Schema['/users']['POST']>
        >();

        expect(response.request.url).toBe(joinURL(baseURL, '/users'));

        expect(response.request.path).toBe('/users');
        expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();

        expect(response.request.method).toBe('POST');
        expectTypeOf(response.request.method).toEqualTypeOf<'POST'>();

        expect(response.request.headers).toBeInstanceOf(Headers);
        expectTypeOf(response.request.headers).toEqualTypeOf<
          StrictHeaders<{ 'content-type': 'application/octet-stream' }>
        >();

        expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expectTypeOf(response.request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
        expect(await response.request.arrayBuffer()).toEqual(new ArrayBuffer(0));
        expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
        expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<FormData>>();
        expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
      });
    });
  });

  it('should show a type error if trying to use a non-assignable request body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: { name?: string };
          };
          response: {
            204: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      interceptor.post('/users').respond({ status: 204 });

      const fetch = createFetch<Schema>({ baseURL });

      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // @ts-expect-error Forcing an invalid request body
      await fetch('/users', {
        method: 'POST',
        body: 'invalid',
      });
    });
  });

  it('should not allow declaring request bodies for methods that do not support them', () => {
    // @ts-expect-error GET methods do not support request bodies
    createFetch<{ '/users': { GET: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: {} } } }>({ baseURL });

    // @ts-expect-error HEAD methods do not support request bodies
    createFetch<{ '/users': { HEAD: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: {} } } }>({ baseURL });

    // @ts-expect-error OPTIONS methods do not support request bodies
    createFetch<{ '/users': { OPTIONS: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { POST: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { PUT: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { PATCH: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { DELETE: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: {} } } }>({ baseURL });
  });

  it('should not allow declaring response bodies for methods or statuses that do not support them', () => {
    // @ts-expect-error HEAD methods do not support request bodies
    createFetch<{ '/users': { HEAD: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { HEAD: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { GET: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { GET: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { POST: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { POST: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { PUT: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { PUT: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { PATCH: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { PATCH: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { DELETE: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { DELETE: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: {} } } } }>({ baseURL });
  });
});
