import { HttpSchema, HttpSchemaPath } from '@zimic/http';
import expectFetchError from '@zimic/utils/fetch/expectFetchError';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { isClientSide } from '@/utils/environment';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { expectResponseStatus } from '@tests/utils/requests';

import createFetch from '../factory';

describe('FetchClient > Redirects', () => {
  const baseURL = 'http://localhost:3000';

  it.each(['manual'] as const)('should support making requests with redirect: %s', async (redirect) => {
    type Schema = HttpSchema<{
      '/:slug': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'text/html' };
              body: string;
            };
            301: { headers: { location: HttpSchemaPath<Schema> } };
            304: {};
            307: { headers: { location: HttpSchemaPath<Schema> } };
            308: { headers: { location: HttpSchemaPath<Schema> } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/original')
        .respond({
          status: 301,
          headers: { location: '/redirected' },
        })
        .times(1);

      await interceptor
        .get('/redirected')
        .respond({
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html></html>',
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const firstResponse = await fetch('/original', {
        method: 'GET',
        redirect,
      });

      expectTypeOf(firstResponse.status).toEqualTypeOf<200 | 301 | 304 | 307 | 308>();

      let redirectPath: HttpSchemaPath<Schema> | undefined;

      if (isClientSide()) {
        // In the browser, the response is opaque and the status is 0. No headers are available.
        expectResponseStatus(firstResponse, 0);
        redirectPath = '/redirected';
      } else {
        expectResponseStatus(firstResponse, 301);
        redirectPath = firstResponse.headers.get('location');
      }

      expect(redirectPath).not.toBe(null);

      const secondResponse = await fetch(redirectPath, {
        method: 'GET',
        redirect: 'manual',
      });

      expectTypeOf(secondResponse.status).toEqualTypeOf<200 | 301 | 304 | 307 | 308>();
      expectResponseStatus(secondResponse, 200);

      expect(secondResponse.headers.get('content-type')).toBe('text/html');

      expect(await secondResponse.text()).toBe('<html></html>');
    });
  });

  it.each(['follow', undefined] as const)('should support making requests with redirect: %s', async (redirect) => {
    type Schema = HttpSchema<{
      '/:slug': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'text/html' };
              body: string;
            };
            301: { headers: { location: HttpSchemaPath<Schema> } };
            304: {};
            307: { headers: { location: HttpSchemaPath<Schema> } };
            308: { headers: { location: HttpSchemaPath<Schema> } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/original')
        .respond({
          status: 301,
          headers: { location: '/redirected' },
        })
        .times(1);

      await interceptor
        .get('/redirected')
        .respond({
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html></html>',
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const response = await fetch('/original', {
        method: 'GET',
        redirect,
      });

      expectTypeOf(response.status).toEqualTypeOf<200 | 304>();
      expectResponseStatus(response, 200);

      expect(response.headers.get('content-type')).toBe('text/html');

      expect(await response.text()).toBe('<html></html>');
    });
  });

  it.each(['error'] as const)('should support making requests with redirect: %s', async (redirect) => {
    type Schema = HttpSchema<{
      '/:slug': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'text/html' };
              body: string;
            };
            301: { headers: { location: HttpSchemaPath<Schema> } };
            304: {};
            307: { headers: { location: HttpSchemaPath<Schema> } };
            308: { headers: { location: HttpSchemaPath<Schema> } };
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      await interceptor
        .get('/original')
        .respond({
          status: 301,
          headers: { location: '/redirected' },
        })
        .times(1);

      await interceptor
        .get('/redirected')
        .respond({
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html></html>',
        })
        .times(0);

      const fetch = createFetch<Schema>({ baseURL });

      const responsePromise = fetch('/original', {
        method: 'GET',
        redirect,
      });
      await expectFetchError(responsePromise);
    });
  });
});
