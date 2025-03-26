import { HttpSchema, HttpSearchParams, StrictFormData, StrictHeaders } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';
import { FetchRequest, FetchResponse } from '../types/requests';

describe('FetchClient > Bodies > Search params', () => {
  const baseURL = 'http://localhost:3000';

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      const receivedResponseSearchParams = await response.formData();
      expect(Array.from(receivedResponseSearchParams.entries())).toHaveLength(responseSearchParams.size);

      expect(receivedResponseSearchParams.get('title')).toBe(responseSearchParams.get('title'));
      expect(receivedResponseSearchParams.getAll('descriptions')).toEqual(responseSearchParams.getAll('descriptions'));

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

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
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

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

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
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

      expectResponseStatus(response, 201);
      expect(await response.text()).toBe('');

      expect(response).toBeInstanceOf(Response);
      expectTypeOf(response satisfies Response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();

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
      expectTypeOf(response.request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

      expect(response.request.url).toBe(joinURL(baseURL, '/users'));

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
