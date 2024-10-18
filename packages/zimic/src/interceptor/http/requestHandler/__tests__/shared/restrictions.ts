import { expectTypeOf, expect, it, beforeAll, afterAll, describe } from 'vitest';

import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { SharedHttpInterceptorClient } from '@/interceptor/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import { joinURL } from '@/utils/urls';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import type RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { HeadersSchema, MethodSchema, Schema, SearchParamsSchema, SharedHttpRequestHandlerTestOptions } from './types';

export function declareRestrictionHttpRequestHandlerTests(
  options: SharedHttpRequestHandlerTestOptions & {
    type: HttpInterceptorType;
    Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
  },
) {
  const { platform, type, startServer, getBaseURL, stopServer, Handler } = options;

  let baseURL: URL;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let interceptorClient: SharedHttpInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }

    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    interceptorClient = interceptor.client() as SharedHttpInterceptorClient<Schema>;

    await interceptor.start();
    expect(interceptor.platform()).toBe(platform);
  });

  afterAll(async () => {
    await interceptor.stop();

    if (type === 'remote') {
      await stopServer?.();
    }
  });

  describe('By search params', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            searchParams: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingSearchParams of [new HttpSearchParams<SearchParamsSchema>({ name })]) {
          const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingSearchParams of [
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
          new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
          new HttpSearchParams<SearchParamsSchema>({}),
        ]) {
          const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            searchParams: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingSearchParams of [
          new HttpSearchParams<SearchParamsSchema>({ name }),
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
        ]) {
          const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingSearchParams of [
          new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
          new HttpSearchParams<SearchParamsSchema>({ name: 'other' }),
          new HttpSearchParams<SearchParamsSchema>({}),
        ]) {
          const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it('should match only specific requests if contains a declared response and a computed search params restriction', async () => {
      const name = 'User';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .with((request) => {
          expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
          expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

          const nameParam = request.searchParams.get('name');
          return nameParam?.startsWith(name) ?? false;
        })
        .respond({
          status: 200,
          body: { success: true },
        });

      for (const matchingSearchParams of [
        new HttpSearchParams<SearchParamsSchema>({ name }),
        new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
        new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
      ]) {
        const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
        expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      }

      for (const mismatchingSearchParams of [
        new HttpSearchParams<SearchParamsSchema>({ name: `Other ${name}` }),
        new HttpSearchParams<SearchParamsSchema>({}),
      ]) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }
    });
  });

  describe('By headers', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const contentLanguage = 'en';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            headers: { 'content-language': contentLanguage },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingHeaders of [new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage })]) {
          const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingHeaders of [
          new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*' }),
          new HttpHeaders<HeadersSchema>({ 'content-language': `${contentLanguage}/other` }),
          new HttpHeaders<HeadersSchema>({}),
        ]) {
          const request = new Request(baseURL, { headers: mismatchingHeaders });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const contentLanguage = 'en';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            headers: { 'content-language': contentLanguage },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingHeaders of [
          new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
          new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*' }),
        ]) {
          const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingHeaders of [
          new HttpHeaders<HeadersSchema>({ 'content-language': `${contentLanguage}/other` }),
          new HttpHeaders<HeadersSchema>({ 'content-language': 'other' }),
          new HttpHeaders<HeadersSchema>({}),
        ]) {
          const request = new Request(baseURL, { headers: mismatchingHeaders });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it('should match only specific requests if contains a declared response and a computed header restriction', async () => {
      const contentLanguage = 'en';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .with((request) => {
          expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HeadersSchema>>();
          expect(request.headers).toBeInstanceOf(HttpHeaders);

          const nameParam = request.headers.get('content-language');
          return nameParam?.startsWith(contentLanguage) ?? false;
        })
        .respond({
          status: 200,
          body: { success: true },
        });

      for (const matchingHeaders of [
        new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
        new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*' }),
        new HttpHeaders<HeadersSchema>({ 'content-language': `${contentLanguage}/other` }),
      ]) {
        const matchingRequest = new Request(baseURL, { headers: matchingHeaders });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
        expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      }

      for (const mismatchingHeaders of [
        new HttpHeaders<HeadersSchema>({ 'content-language': `other/${contentLanguage}` }),
        new HttpHeaders<HeadersSchema>({}),
      ]) {
        const request = new Request(baseURL, { headers: mismatchingHeaders });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }
    });
  });

  describe('By body', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static body restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            body: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingBody of [{ name }] satisfies MethodSchema['request']['body'][]) {
          const matchingRequest = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(matchingBody),
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingBody of [
          { name, value: [] },
          { name, value: [1, 2] },
          {},
        ] satisfies MethodSchema['request']['body'][]) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mismatchingBody),
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({
            body: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingBody of [
          { name },
          { name, value: [] },
          { name, value: [1, 2] },
        ] satisfies MethodSchema['request']['body'][]) {
          const matchingRequest = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(matchingBody),
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
          expect(await handler.matchesRequest(parsedRequest)).toBe(true);
        }

        for (const mismatchingBody of [{}] satisfies MethodSchema['request']['body'][]) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mismatchingBody),
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
          expect(await handler.matchesRequest(parsedRequest)).toBe(false);
        }
      },
    );

    it('should match only specific requests if contains a declared response and a computed body restriction', async () => {
      const name = 'User';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .with((request) => {
          expectTypeOf(request.body).toEqualTypeOf<MethodSchema['request']['body']>();

          return request.body.name?.startsWith(name) ?? false;
        })
        .respond({
          status: 200,
          body: { success: true },
        });

      for (const matchingBody of [
        { name },
        { name, value: [1] },
        { name: `${name}-other` },
      ] satisfies MethodSchema['request']['body'][]) {
        const matchingRequest = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(matchingBody),
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
        expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      }

      for (const mismatchingBody of [{ name: `Other ${name}` }, {}] satisfies MethodSchema['request']['body'][]) {
        const request = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mismatchingBody),
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }
    });
  });

  it('should match only specific requests if contains a declared response and multiple restrictions', async () => {
    const name = 'User';
    const contentLanguage = 'en';

    const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
      .with({
        headers: { 'content-language': contentLanguage },
        searchParams: { name },
      })
      .with((request) => {
        expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<HeadersSchema>>();
        expect(request.headers).toBeInstanceOf(HttpHeaders);

        expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<SearchParamsSchema>>();
        expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

        const matchesHeaders = request.headers.get('accept')?.includes('*/*') ?? false;
        const matchesSearchParams = request.searchParams.get('other')?.includes('param') ?? false;

        return matchesHeaders && matchesSearchParams;
      })
      .respond({
        status: 200,
        body: { success: true },
      });

    const matchingHeadersSamples = [
      new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*' }),
      new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: 'application/json, */*' }),
      new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*, application/json' }),
    ];

    const mismatchingHeadersSamples = [
      new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: 'application/json' }),
      new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
      new HttpHeaders<HeadersSchema>({}),
    ];

    const matchingSearchParamsSamples = [
      new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
      new HttpSearchParams<SearchParamsSchema>({ name, other: 'prefix-param' }),
      new HttpSearchParams<SearchParamsSchema>({ name, other: 'param-suffix' }),
      new HttpSearchParams<SearchParamsSchema>({ name, other: 'prefix-param-suffix' }),
    ];

    const mismatchingSearchParamsSamples = [
      new HttpSearchParams<SearchParamsSchema>({ name }),
      new HttpSearchParams<SearchParamsSchema>({ name: `Other ${name}` }),
      new HttpSearchParams<SearchParamsSchema>({ other: 'param' }),
      new HttpSearchParams<SearchParamsSchema>({ other: `Other param` }),
      new HttpSearchParams<SearchParamsSchema>({}),
    ];

    for (const matchingHeaders of matchingHeadersSamples) {
      for (const matchingSearchParams of matchingSearchParamsSamples) {
        const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`), {
          headers: matchingHeaders,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
        expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      }

      for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`), {
          headers: matchingHeaders,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }
    }

    for (const mismatchingHeaders of mismatchingHeadersSamples) {
      for (const matchingSearchParams of matchingSearchParamsSamples) {
        const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`), {
          headers: mismatchingHeaders,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }

      for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`), {
          headers: mismatchingHeaders,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);
        expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      }
    }
  });
}
