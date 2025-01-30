import { expect, it, beforeAll, afterAll, describe } from 'vitest';

import { SharedHttpInterceptorClient } from '@/interceptor/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import { joinURL } from '@/utils/urls';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import type RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { MethodSchema, Schema, SharedHttpRequestHandlerTestOptions } from './types';
import { expectTimesCheckError } from './utils';

export function declareTimesHttpRequestHandlerTests(
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

  describe('Exact number of requests', () => {
    it('should match an exact number of limited requests', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      await promiseIfRemote(handler.times(2), handler);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      await promiseIfRemote(handler.times(3), handler);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should match less than an exact number of limited requests', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(2);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 2 requests, but got 0.', minNumberOfRequests: 2 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 2 requests, but got 1.', minNumberOfRequests: 2 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      handler.times(4);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 4 requests, but got 3.', minNumberOfRequests: 4 },
      );
    });

    it('should not match to more than an exact number of limited requests', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 2.', numberOfRequests: 1 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 3.', numberOfRequests: 1 },
      );
    });
  });

  describe('Range number of requests', () => {
    it('should match the minimum number of requests limited in a range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(0, 3);

      await promiseIfRemote(handler.checkTimes(), handler);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should match less than the minimum number of requests limited in a range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(2, 3);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        {
          firstLine: 'Expected at least 2 and at most 3 requests, but got 0.',
          minNumberOfRequests: 2,
          maxNumberOfRequests: 3,
        },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        {
          firstLine: 'Expected at least 2 and at most 3 requests, but got 1.',
          minNumberOfRequests: 2,
          maxNumberOfRequests: 3,
        },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should match the maximum number of requests limited in a range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(2, 3);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should not match to more than the maximum number of requests limited in a range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(2, 3);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        {
          firstLine: 'Expected at least 2 and at most 3 requests, but got 4.',
          minNumberOfRequests: 2,
          maxNumberOfRequests: 3,
        },
      );
    });

    it('should match the exact number of requests limited in a range including zero', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(0, 1);

      await promiseIfRemote(handler.checkTimes(), handler);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        {
          firstLine: 'Expected at least 0 and at most 1 request, but got 2.',
          minNumberOfRequests: 0,
          maxNumberOfRequests: 1,
        },
      );
    });

    it('should match the exact number of requests limited in a unitary range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(1, 1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', minNumberOfRequests: 1, maxNumberOfRequests: 1 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 2.', minNumberOfRequests: 1, maxNumberOfRequests: 1 },
      );
    });

    it('should match the exact number of requests limited in a non-unitary range', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(2, 2);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 2 requests, but got 0.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 2 requests, but got 1.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 2 requests, but got 3.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );
    });
  });

  describe('Unmatched requests', () => {
    it('should not consider requests unmatched due to restrictions in time checks', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .with({ searchParams: { value: '1' } })
        .respond({ status: 200, body: { success: true } })
        .times(1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );
    });

    it('should not consider requests unmatched due to missing response declarations in time checks', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').times(1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );
    });
  });

  describe('Clear', () => {
    it('should reset an exact number of requests limit when cleared', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(1);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { firstLine: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
      );

      handler.clear();

      await promiseIfRemote(handler.checkTimes(), handler);

      handler.respond({ status: 200, body: { success: true } }).times(1);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      handler.clear();

      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should reset a range number of requests limit when cleared', async () => {
      const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
        .respond({ status: 200, body: { success: true } })
        .times(1, 3);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        {
          firstLine: 'Expected at least 1 and at most 3 requests, but got 0.',
          minNumberOfRequests: 1,
          maxNumberOfRequests: 3,
        },
      );

      handler.clear();

      await promiseIfRemote(handler.checkTimes(), handler);

      handler.respond({ status: 200, body: { success: true } }).times(1, 3);

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      handler.clear();

      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);
      await promiseIfRemote(handler.checkTimes(), handler);
    });
  });
}
