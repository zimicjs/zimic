import { HttpFormData, HttpSchema, StrictFormData, StrictHeaders } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { importFile } from '@/utils/files';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Bodies > Form data', () => {
  const baseURL = 'http://localhost:3000';

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      const receivedResponseFormData = await response.formData();
      expect(Array.from(receivedResponseFormData.entries())).toHaveLength(2);

      expect(receivedResponseFormData.get('title')).toBe(responseFormData.get('title'));
      expect(receivedResponseFormData.get('file')).toEqual(responseFormData.get('file'));

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

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
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

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
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

      expect(response.request.headers).toBeInstanceOf(Headers);
      expectTypeOf(response.request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'multipart/form-data' }>>();

      expectTypeOf(response.request.json).toEqualTypeOf<() => Promise<null>>();
      expectTypeOf(response.request.text).toEqualTypeOf<() => Promise<string>>();
      expectTypeOf(response.request.formData).toEqualTypeOf<() => Promise<StrictFormData<FormDataSchema> | FormData>>();
      expectTypeOf(response.request.clone).toEqualTypeOf<() => typeof response.request>();
    });
  });
});
