import { expect, it, beforeAll, afterAll, describe } from 'vitest';

import { HttpFormData, HttpSearchParams } from '@/http';
import { SharedHttpInterceptorClient } from '@/interceptor/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { promiseIfRemote } from '@/interceptor/http/interceptorWorker/__tests__/utils/promises';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import { importFile } from '@/utils/files';
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
        { message: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
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
        { message: 'Expected exactly 2 requests, but got 0.', minNumberOfRequests: 2 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { message: 'Expected exactly 2 requests, but got 1.', minNumberOfRequests: 2 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      handler.times(4);
      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { message: 'Expected exactly 4 requests, but got 3.', minNumberOfRequests: 4 },
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
        { message: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
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
        { message: 'Expected exactly 1 request, but got 2.', numberOfRequests: 1 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { message: 'Expected exactly 1 request, but got 3.', numberOfRequests: 1 },
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
          message: 'Expected at least 2 and at most 3 requests, but got 0.',
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
          message: 'Expected at least 2 and at most 3 requests, but got 1.',
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
          message: 'Expected at least 2 and at most 3 requests, but got 4.',
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
          message: 'Expected at least 0 and at most 1 request, but got 2.',
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
        { message: 'Expected exactly 1 request, but got 0.', minNumberOfRequests: 1, maxNumberOfRequests: 1 },
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
        { message: 'Expected exactly 1 request, but got 2.', minNumberOfRequests: 1, maxNumberOfRequests: 1 },
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
        { message: 'Expected exactly 2 requests, but got 0.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );

      const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
      const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { message: 'Expected exactly 2 requests, but got 1.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );

      expect(await handler.matchesRequest(parsedRequest)).toBe(true);
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.matchesRequest(parsedRequest)).toBe(false);

      await expectTimesCheckError(
        async () => {
          await promiseIfRemote(handler.checkTimes(), handler);
        },
        { message: 'Expected exactly 2 requests, but got 3.', minNumberOfRequests: 2, maxNumberOfRequests: 2 },
      );
    });
  });

  describe('Unmatched requests', () => {
    describe('Restrictions', () => {
      it('should not include the requests unmatched due to restrictions if not saving requests', async () => {
        const interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL, saveRequests: false });
        const interceptorClient = interceptor.client() as SharedHttpInterceptorClient<Schema>;

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with((request) => typeof request.body === 'number')
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Tip: enable `saveRequests: true` in your interceptor for more details about the unmatched requests.',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Tip: enable `saveRequests: true` in your interceptor for more details about the unmatched requests.',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to computed restrictions in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with((request) => typeof request.body === 'number')
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Computed restriction:',
              '       - return true',
              '       + return false',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to headers restrictions in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ headers: { accept: 'application/json' } })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Headers:',
              '       - { "accept": "application/json" }',
              '       + {}',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { accept: 'text/html', 'content-type': 'text/plain' },
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Headers:',
              '       - { "accept": "application/json" }',
              '       + {}',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Headers:',
              '       - { "accept": "application/json" }',
              '       + { "accept": "text/html", "content-type": "text/plain" }',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to search params requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ searchParams: { value: '1' } })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Search params:',
              '       - { "value": "1" }',
              '       + {}',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        const searchParams = new HttpSearchParams({ name: '1', value: '2' });
        request = new Request(joinURL(baseURL, `/users?${searchParams}`), { method: 'POST' });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Search params:',
              '       - { "value": "1" }',
              '       + {}',
              '',
              `2: POST ${joinURL(baseURL, `/users?${searchParams}`)}`,
              '     Search params:',
              '       - { "value": "1" }',
              '       + { "name": "1", "value": "2" }',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to JSON body requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ body: { name: '1' } })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - { "name": "1" }',
              '       + null',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '2' }),
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - { "name": "1" }',
              '       + null',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - { "name": "1" }',
              '       + { "name": "2" }',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to search params matched requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ body: new HttpSearchParams({ name: '1' }) })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - URLSearchParams { "name": "1" }',
              '       + null',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new HttpSearchParams({ name: '2' }),
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - URLSearchParams { "name": "1" }',
              '       + null',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - URLSearchParams { "name": "1" }',
              '       + URLSearchParams { "name": "2" }',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to form data matched requests in times check errors', async () => {
        const formDataRestriction = new HttpFormData<{ name: string }>();
        formDataRestriction.append('name', '1');

        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ body: formDataRestriction })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - FormData { "name": "1" }',
              '       + null',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        const formData = new HttpFormData<{ name: string; file: File; blob: Blob }>();
        formData.append('name', '2');

        const File = await importFile();

        const blob = new Blob(['response'], { type: 'text/plain' });
        formData.append('blob', blob);

        const file = new File([blob], 'tag.txt', { type: 'text/plain' });
        formData.append('file', file);

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          body: formData,
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - FormData { "name": "1" }',
              '       + null',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - FormData { "name": "1" }',
              '       + FormData { ' +
                '"name": "2", ' +
                "\"blob\": File { name: 'blob', type: 'text/plain', size: 8 }, " +
                "\"file\": File { name: 'tag.txt', type: 'text/plain', size: 8 } " +
                '}',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the requests unmatched due to blob body requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ body: new Blob(['1'], { type: 'application/octet-stream' }) })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              "       - Blob { type: 'application/octet-stream', size: 1 }",
              '       + null',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          body: new Blob(['blob'], { type: 'application/octet-stream' }),
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              "       - Blob { type: 'application/octet-stream', size: 1 }",
              '       + null',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              "       - Blob { type: 'application/octet-stream', size: 1 }",
              "       + Blob { type: 'application/octet-stream', size: 4 }",
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });

      it('should include the list unmatched due to plain-text matched requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users')
          .with({ body: 'example' })
          .respond({ status: 200, body: { success: true } })
          .times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 matching request, but got 0.', numberOfRequests: 1 },
        );

        let request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        let parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - example',
              '       + null',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );

        request = new Request(joinURL(baseURL, '/users'), {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'text',
        });
        parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          {
            message: [
              'Expected exactly 1 matching request, but got 0.',
              '',
              'Requests evaluated by this handler:',
              '',
              '  - Expected',
              '  + Received',
              '',
              `1: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - example',
              '       + null',
              '',
              `2: POST ${joinURL(baseURL, '/users')}`,
              '     Body:',
              '       - example',
              '       + text',
            ].join('\n'),
            numberOfRequests: 1,
          },
        );
      });
    });

    describe('Response declarations', () => {
      it('should include the requests unmatched due to missing response requests in times check errors', async () => {
        const handler = new Handler<Schema, 'POST', '/users'>(interceptorClient, 'POST', '/users').times(1);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
        );

        const request = new Request(joinURL(baseURL, '/users'), { method: 'POST' });
        const parsedRequest = await HttpInterceptorWorker.parseRawRequest<'/users', MethodSchema>(request);

        expect(await handler.matchesRequest(parsedRequest)).toBe(false);

        await expectTimesCheckError(
          async () => {
            await promiseIfRemote(handler.checkTimes(), handler);
          },
          { message: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
        );
      });
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
        { message: 'Expected exactly 1 request, but got 0.', numberOfRequests: 1 },
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
          message: 'Expected at least 1 and at most 3 requests, but got 0.',
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
