import { HttpHeaders, HttpSearchParams } from '@zimic/http';
import { joinURL } from '@zimic/utils/url';
import { expectTypeOf, expect, it, beforeAll, afterAll, describe, beforeEach, afterEach } from 'vitest';

import { SharedHttpInterceptorImplementation } from '@/http/interceptor/HttpInterceptorImplementation';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/http/interceptor/types/options';
import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import { HttpRequestHandlerRequestMatch } from '../../HttpRequestHandlerImplementation';
import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import type RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { RestrictionDiffs } from '../../types/restrictions';
import { HeadersSchema, MethodSchema, Schema, SearchParamsSchema, SharedHttpRequestHandlerTestOptions } from './types';

export function declareRestrictionHttpRequestHandlerTests(
  options: SharedHttpRequestHandlerTestOptions & {
    type: HttpInterceptorType;
    Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
  },
) {
  const { type, startServer, getBaseURL, stopServer, Handler } = options;

  let baseURL: string;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let interceptorImplementation: SharedHttpInterceptorImplementation<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    interceptorImplementation = interceptor.implementation as SharedHttpInterceptorImplementation<Schema>;

    await interceptor.start();
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  // No HTTP counterpart for "By path": HTTP handlers always declare their path, while WebSocket connection handlers may
  // omit it.

  describe('By search params', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({
            searchParams: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingSearchParams of [new HttpSearchParams<SearchParamsSchema>({ name })]) {
          const request = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        for (const mismatchingSearchParams of [
          new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' }),
          new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
          new HttpSearchParams<SearchParamsSchema>({}),
        ]) {
          const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              searchParams: {
                expected: new HttpSearchParams<SearchParamsSchema>({ name }),
                received: mismatchingSearchParams,
              },
            },
          });
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
          const request = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        for (const mismatchingSearchParams of [
          new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` }),
          new HttpSearchParams<SearchParamsSchema>({ name: 'other' }),
          new HttpSearchParams<SearchParamsSchema>({}),
        ]) {
          const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              searchParams: {
                expected: new HttpSearchParams<SearchParamsSchema>({ name }),
                received: mismatchingSearchParams,
              },
            },
          });
        }
      },
    );

    it('should match only specific requests if contains a declared response and a computed search params restriction', async () => {
      const name = 'User';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
        const request = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`));

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
      }

      for (const mismatchingSearchParams of [
        new HttpSearchParams<SearchParamsSchema>({ name: `Other ${name}` }),
        new HttpSearchParams<SearchParamsSchema>({}),
      ]) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`));

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: {
            computed: { expected: true, received: false },
          },
        });
      }
    });
  });

  describe('By headers', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const contentLanguage = 'en';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({
            headers: { 'content-language': contentLanguage },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingHeaders of [new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage })]) {
          const request = new Request(baseURL, { headers: matchingHeaders });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        for (const mismatchingHeaders of [
          new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage, accept: '*/*' }),
          new HttpHeaders<HeadersSchema>({ 'content-language': `${contentLanguage}/other` }),
          new HttpHeaders<HeadersSchema>({}),
        ]) {
          const request = new Request(baseURL, { headers: mismatchingHeaders });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              headers: {
                expected: new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
                received: mismatchingHeaders,
              },
            },
          });
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const contentLanguage = 'en';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
          const request = new Request(baseURL, { headers: matchingHeaders });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        for (const mismatchingHeaders of [
          new HttpHeaders<HeadersSchema>({ 'content-language': `${contentLanguage}/other` }),
          new HttpHeaders<HeadersSchema>({ 'content-language': 'other' }),
          new HttpHeaders<HeadersSchema>({}),
        ]) {
          const request = new Request(baseURL, { headers: mismatchingHeaders });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              headers: {
                expected: new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
                received: mismatchingHeaders,
              },
            },
          });
        }
      },
    );

    it('should match only specific requests if contains a declared response and a computed header restriction', async () => {
      const contentLanguage = 'en';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
        const request = new Request(baseURL, { headers: matchingHeaders });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
      }

      for (const mismatchingHeaders of [
        new HttpHeaders<HeadersSchema>({ 'content-language': `other/${contentLanguage}` }),
        new HttpHeaders<HeadersSchema>({}),
      ]) {
        const request = new Request(baseURL, { headers: mismatchingHeaders });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: {
            computed: { expected: true, received: false },
          },
        });
      }
    });
  });

  describe('By body', () => {
    it.each([{ exact: true }])(
      'should match only specific requests if contains a declared response, a static body restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({
            body: { name },
            exact,
          })
          .respond({
            status: 200,
            body: { success: true },
          });

        for (const matchingBody of [{ name }] satisfies MethodSchema['request']['body'][]) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(matchingBody),
          });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
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

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              body: { expected: { name }, received: mismatchingBody },
            },
          });
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a declared response, a static header restriction, and exact $exact',
      async ({ exact }) => {
        const name = 'User';

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(matchingBody),
          });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        for (const mismatchingBody of [{}] satisfies MethodSchema['request']['body'][]) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mismatchingBody),
          });

          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              body: { expected: { name }, received: mismatchingBody },
            },
          });
        }
      },
    );

    it.each([{ exact: true }])(
      'should match only specific requests if contains a static text restriction and exact $exact',
      async ({ exact }) => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({ body: 'content', exact })
          .respond({ status: 200, body: { success: true } });

        const matchingRequest = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'content',
        });
        const parsedMatchingRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
          matchingRequest,
        );

        expect(await handler.matchesRequest(parsedMatchingRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: true,
        });

        for (const mismatchingBody of ['more-content', '"content"', 'cont']) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: mismatchingBody,
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: false,
            cause: 'unmatchedRestrictions',
            diff: {
              body: { expected: 'content', received: mismatchingBody },
            },
          });
        }
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific requests if contains a static text restriction and exact $exact',
      async ({ exact }) => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({ body: 'content', exact })
          .respond({ status: 200, body: { success: true } });

        for (const matchingBody of ['content', 'more-content', '"content"']) {
          const request = new Request(baseURL, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: matchingBody,
          });
          const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

          expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
            success: true,
          });
        }

        const mismatchingBody = 'cont';

        const request = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: mismatchingBody,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: {
            body: { expected: 'content', received: mismatchingBody },
          },
        });
      },
    );

    it.each([{ exact: true }, { exact: false }])(
      'should not match JSON requests if contains a static text restriction and exact $exact',
      async ({ exact }) => {
        const jsonBody = { name: 'content' };
        const jsonBodyAsText = JSON.stringify(jsonBody);

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
          .with({ body: jsonBodyAsText, exact })
          .respond({ status: 200, body: { success: true } });

        const request = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: jsonBodyAsText,
        });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: {
            body: { expected: jsonBodyAsText, received: jsonBody },
          },
        });
      },
    );

    it('should match only specific requests if contains a declared response and a computed body restriction', async () => {
      const name = 'User';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
        .with((request) => {
          expectTypeOf(request.body).toEqualTypeOf<MethodSchema['request']['body']>();

          const bodyName = typeof request.body === 'object' && 'name' in request.body ? request.body.name : undefined;

          return bodyName?.startsWith(name) ?? false;
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
        const request = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(matchingBody),
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
      }

      for (const mismatchingBody of [{}, { name: `Other ${name}` }, {}] satisfies MethodSchema['request']['body'][]) {
        const request = new Request(baseURL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mismatchingBody),
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: {
            computed: { expected: true, received: false },
          },
        });
      }
    });
  });

  // No HTTP counterpart for "By protocols": HTTP requests negotiate no subprotocols.

  it.each([{ exact: true }])(
    'should match only specific requests if contains a declared response, a static restriction of search params and headers, and exact $exact',
    async ({ exact }) => {
      const name = 'User';
      const accept = 'application/json';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
        .with({ searchParams: { name }, headers: { accept }, exact })
        .respond({ status: 200, body: { success: true } });

      const matchingRequest = new Request(joinURL(baseURL, `?name=${name}`), { headers: { accept } });
      const parsedMatchingRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
        matchingRequest,
      );

      expect(await handler.matchesRequest(parsedMatchingRequest)).toEqual<HttpRequestHandlerRequestMatch>({
        success: true,
      });

      const extraSearchParams = new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' });
      const requestWithExtraSearchParam = new Request(joinURL(baseURL, `?${extraSearchParams.toString()}`), {
        headers: { accept },
      });
      const parsedRequestWithExtraSearchParam = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
        requestWithExtraSearchParam,
      );

      expect(await handler.matchesRequest(parsedRequestWithExtraSearchParam)).toEqual<HttpRequestHandlerRequestMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        diff: {
          searchParams: {
            expected: new HttpSearchParams<SearchParamsSchema>({ name }),
            received: extraSearchParams,
          },
        },
      });

      const extraHeaders = new HttpHeaders<HeadersSchema>({ accept, 'content-language': 'en' });
      const requestWithExtraHeader = new Request(joinURL(baseURL, `?name=${name}`), { headers: extraHeaders });
      const parsedRequestWithExtraHeader = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
        requestWithExtraHeader,
      );

      expect(await handler.matchesRequest(parsedRequestWithExtraHeader)).toEqual<HttpRequestHandlerRequestMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        diff: {
          headers: {
            expected: new HttpHeaders<HeadersSchema>({ accept }),
            received: extraHeaders,
          },
        },
      });
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only specific requests if contains a declared response, a static restriction of search params and headers, and exact $exact',
    async ({ exact }) => {
      const name = 'User';
      const accept = 'application/json';

      const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
        .with({ searchParams: { name }, headers: { accept }, exact })
        .respond({ status: 200, body: { success: true } });

      const matchingSearchParams = new HttpSearchParams<SearchParamsSchema>({ name, other: 'param' });
      const matchingRequest = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`), {
        headers: { accept, 'content-language': 'en' },
      });
      const parsedMatchingRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
        matchingRequest,
      );

      expect(await handler.matchesRequest(parsedMatchingRequest)).toEqual<HttpRequestHandlerRequestMatch>({
        success: true,
      });

      const mismatchingSearchParams = new HttpSearchParams<SearchParamsSchema>({ name: `${name} other` });
      const requestWithMismatchingSearchParam = new Request(
        joinURL(baseURL, `?${mismatchingSearchParams.toString()}`),
        { headers: { accept } },
      );
      const parsedRequestWithMismatchingSearchParam = await HttpInterceptorWorker.parseRawRequest<
        '/users',
        MethodSchema
      >(requestWithMismatchingSearchParam);

      expect(
        await handler.matchesRequest(parsedRequestWithMismatchingSearchParam),
      ).toEqual<HttpRequestHandlerRequestMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        diff: {
          searchParams: {
            expected: new HttpSearchParams<SearchParamsSchema>({ name }),
            received: mismatchingSearchParams,
          },
        },
      });

      const mismatchingHeaders = new HttpHeaders<HeadersSchema>({ accept: 'text/html' });
      const requestWithMismatchingHeader = new Request(joinURL(baseURL, `?name=${name}`), {
        headers: mismatchingHeaders,
      });
      const parsedRequestWithMismatchingHeader = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
        requestWithMismatchingHeader,
      );

      expect(await handler.matchesRequest(parsedRequestWithMismatchingHeader)).toEqual<HttpRequestHandlerRequestMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        diff: {
          headers: {
            expected: new HttpHeaders<HeadersSchema>({ accept }),
            received: mismatchingHeaders,
          },
        },
      });
    },
  );

  it('should match only specific requests if contains a declared response and asynchronous computed restrictions', async () => {
    const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
      .with(async (request) => {
        await Promise.resolve();
        return request.searchParams.get('name') === 'User';
      })
      .respond({
        status: 200,
        body: { success: true },
      });

    const matchingRequest = new Request(joinURL(baseURL, '?name=User'));
    const parsedMatchingRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(matchingRequest);

    expect(await handler.matchesRequest(parsedMatchingRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: true,
    });

    const mismatchingRequest = new Request(joinURL(baseURL, '?name=Other'));
    const parsedMismatchingRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(
      mismatchingRequest,
    );

    expect(await handler.matchesRequest(parsedMismatchingRequest)).toEqual<HttpRequestHandlerRequestMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      diff: {
        computed: { expected: true, received: false },
      },
    });
  });

  it('should match only specific requests if contains a declared response and multiple restrictions', async () => {
    const name = 'User';
    const contentLanguage = 'en';

    const handler = new Handler<Schema, 'POST', '/users'>(interceptorImplementation, 'POST', '/users')
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
      new HttpSearchParams<SearchParamsSchema>({ other: 'Other param' }),
      new HttpSearchParams<SearchParamsSchema>({}),
    ];

    for (const matchingHeaders of matchingHeadersSamples) {
      for (const matchingSearchParams of matchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`), {
          headers: matchingHeaders,
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({ success: true });
      }

      for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`), {
          headers: matchingHeaders,
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: expect.toBeOneOf<RestrictionDiffs>([
            {
              searchParams: {
                expected: new HttpSearchParams<SearchParamsSchema>({ name }),
                received: mismatchingSearchParams,
              },
            },
            {
              computed: { expected: true, received: false },
            },
          ]) as RestrictionDiffs,
        });
      }
    }

    for (const mismatchingHeaders of mismatchingHeadersSamples) {
      for (const matchingSearchParams of matchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${matchingSearchParams.toString()}`), {
          headers: mismatchingHeaders,
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: expect.toBeOneOf<RestrictionDiffs>([
            {
              headers: {
                expected: new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
                received: mismatchingHeaders,
              },
            },
            {
              computed: { expected: true, received: false },
            },
          ]) as RestrictionDiffs,
        });
      }

      for (const mismatchingSearchParams of mismatchingSearchParamsSamples) {
        const request = new Request(joinURL(baseURL, `?${mismatchingSearchParams.toString()}`), {
          headers: mismatchingHeaders,
        });

        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toEqual<HttpRequestHandlerRequestMatch>({
          success: false,
          cause: 'unmatchedRestrictions',
          diff: expect.toBeOneOf<RestrictionDiffs>([
            {
              headers: {
                expected: new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
                received: mismatchingHeaders,
              },
            },
            {
              searchParams: {
                expected: new HttpSearchParams<SearchParamsSchema>({ name }),
                received: mismatchingSearchParams,
              },
            },
            {
              headers: {
                expected: new HttpHeaders<HeadersSchema>({ 'content-language': contentLanguage }),
                received: mismatchingHeaders,
              },
              searchParams: {
                expected: new HttpSearchParams<SearchParamsSchema>({ name }),
                received: mismatchingSearchParams,
              },
            },
            {
              computed: { expected: true, received: false },
            },
          ]) as RestrictionDiffs,
        });
      }
    }
  });
}
