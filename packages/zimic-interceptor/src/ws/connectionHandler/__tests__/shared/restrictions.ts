import { HttpSearchParams } from '@zimic/utils/http';
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { expectWebSocketConnectionToBeRefused, expectWebSocketConnectionToOpen } from '@tests/utils/webSocket';

import { WebSocketInterceptorConnectionRequest } from '../../../interceptor/types/messages';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketConnectionHandlerTestOptions } from './utils';

export function declareRestrictionWebSocketConnectionHandlerTests(
  options: SharedWebSocketConnectionHandlerTestOptions & {
    type: WebSocketInterceptorType;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  // Unlike HTTP handlers, whose path is required, connection handlers without a path match every connection to their
  // interceptor, because WebSocket schemas declare no paths.
  describe('By path', () => {
    it('should match only connections to the declared path, relative to the base URL', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection('/rooms/:roomId').respond({ action: 'reject' });

          for (const mismatchingURL of [baseURL, `${baseURL}/rooms`, `${baseURL}/rooms/1/members`]) {
            await expectWebSocketConnectionToOpen(mismatchingURL);
            expect(handler.connections).toHaveLength(0);
          }

          await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/1`);
          expect(handler.connections).toHaveLength(1);
          expect(handler.connections[0].pathParams).toEqual({ roomId: '1' });

          await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/2?token=value`);
          expect(handler.connections).toHaveLength(2);
          expect(handler.connections[1].pathParams).toEqual({ roomId: '2' });
        },
      );
    });

    it('should match every connection to the interceptor if no path is declared', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' });

          await expectWebSocketConnectionToBeRefused(baseURL);
          expect(handler.connections).toHaveLength(1);

          await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/1`);
          expect(handler.connections).toHaveLength(2);
        },
      );
    });
  });

  describe('By search params', () => {
    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: { room: '1', tag: ['a', 'b'] }, exact })
              .respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(`${baseURL}?tag=a&room=1&tag=b`);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].searchParams.toString()).toBe('tag=a&room=1&tag=b');

            for (const mismatchingSearchParams of [
              'room=1&tag=a&tag=b&other=value',
              'room=1&tag=a',
              'room=2&tag=a&tag=b',
              '',
            ]) {
              await expectWebSocketConnectionToOpen(`${baseURL}?${mismatchingSearchParams}`);
              expect(handler.connections).toHaveLength(1);
            }
          },
        );
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response, a static search param restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: new URLSearchParams({ room: '1' }), exact })
              .respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].searchParams.toString()).toBe('room=1');

            await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1&other=value`);
            expect(handler.connections).toHaveLength(2);
            expect(handler.connections[1].searchParams.toString()).toBe('room=1&other=value');

            for (const mismatchingSearchParams of ['room=10', 'room=2', '']) {
              await expectWebSocketConnectionToOpen(`${baseURL}?${mismatchingSearchParams}`);
              expect(handler.connections).toHaveLength(2);
            }
          },
        );
      },
    );

    it('should match only specific connections if contains a declared response and a computed search params restriction', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with((request) => {
              expectTypeOf(request).toEqualTypeOf<WebSocketInterceptorConnectionRequest>();
              expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

              return request.searchParams.get('room') === '1';
            })
            .respond({ action: 'reject' });

          const matchingSearchParams = ['room=1', 'room=1&other=value', 'room=1&room=2'];

          for (const [index, searchParams] of matchingSearchParams.entries()) {
            await expectWebSocketConnectionToBeRefused(`${baseURL}?${searchParams}`);
            expect(handler.connections).toHaveLength(index + 1);
            expect(handler.connections[index].searchParams.toString()).toBe(searchParams);
          }

          for (const mismatchingSearchParams of ['room=2', '']) {
            await expectWebSocketConnectionToOpen(`${baseURL}?${mismatchingSearchParams}`);
            expect(handler.connections).toHaveLength(matchingSearchParams.length);
          }
        },
      );
    });
  });

  // No WebSocket counterpart for "By headers": connection restrictions receive only the URL and requested subprotocols,
  // because browsers cannot set handshake headers.

  // No WebSocket counterpart for "By body": a handshake has no body.

  // No WebSocket connection counterpart for "should match only specific messages if contains a static text restriction
  // and exact $exact": a handshake carries no message data.

  // No WebSocket connection counterpart for "should not match JSON messages if contains a static text restriction and
  // exact $exact": a handshake carries no message data.

  describe('By protocols', () => {
    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response, a static protocol restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat', 'json'], exact })
              .respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(baseURL, ['chat', 'json']);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].protocols).toEqual(['chat', 'json']);

            for (const mismatchingProtocols of [['json', 'chat'], ['chat', 'json', 'other'], ['chat'], ['json'], []]) {
              await expectWebSocketConnectionToOpen(baseURL, mismatchingProtocols);
              expect(handler.connections).toHaveLength(1);
            }
          },
        );
      },
    );

    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response, an empty static protocol restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.connection().with({ protocols: [], exact }).respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(baseURL, []);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].protocols).toEqual([]);

            await expectWebSocketConnectionToOpen(baseURL, ['chat']);
            expect(handler.connections).toHaveLength(1);
          },
        );
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response, a static protocol restriction, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat'], exact })
              .respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(baseURL, ['json', 'chat']);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].protocols).toEqual(['json', 'chat']);

            await expectWebSocketConnectionToBeRefused(baseURL, ['chat']);
            expect(handler.connections).toHaveLength(2);
            expect(handler.connections[1].protocols).toEqual(['chat']);

            await expectWebSocketConnectionToOpen(baseURL);
            expect(handler.connections).toHaveLength(2);

            await expectWebSocketConnectionToOpen(baseURL, ['json']);
            expect(handler.connections).toHaveLength(2);
          },
        );
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response, a static restriction of multiple protocols, and exact $exact',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat', 'json'], exact })
              .respond({ action: 'reject' });

            await expectWebSocketConnectionToBeRefused(baseURL, ['json', 'other', 'chat']);
            expect(handler.connections).toHaveLength(1);
            expect(handler.connections[0].protocols).toEqual(['json', 'other', 'chat']);

            for (const partialProtocols of [['chat'], ['json']]) {
              await expectWebSocketConnectionToOpen(baseURL, partialProtocols);
              expect(handler.connections).toHaveLength(1);
            }
          },
        );
      },
    );

    it('should match only specific connections if contains a declared response and a computed protocol restriction', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with((request) => request.protocols[0] === 'chat')
            .respond({ action: 'reject' });

          const matchingProtocols = [['chat'], ['chat', 'json'], ['chat', 'other']];

          for (const [index, protocols] of matchingProtocols.entries()) {
            await expectWebSocketConnectionToBeRefused(baseURL, protocols);
            expect(handler.connections).toHaveLength(index + 1);
            expect(handler.connections[index].protocols).toEqual(protocols);
          }

          for (const mismatchingProtocols of [['json', 'chat'], []]) {
            await expectWebSocketConnectionToOpen(baseURL, mismatchingProtocols);
            expect(handler.connections).toHaveLength(matchingProtocols.length);
          }
        },
      );
    });
  });

  it.each([{ exact: true }])(
    'should match only specific connections if contains a declared response, a static restriction of search params and protocols, and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ searchParams: { room: '1' }, protocols: ['chat'], exact })
            .respond({ action: 'reject' });

          await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`, ['chat']);
          expect(handler.connections).toHaveLength(1);
          expect(handler.connections[0].searchParams.toString()).toBe('room=1');
          expect(handler.connections[0].protocols).toEqual(['chat']);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=1&other=value`, ['chat']);
          expect(handler.connections).toHaveLength(1);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=1`, ['chat', 'json']);
          expect(handler.connections).toHaveLength(1);
        },
      );
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only specific connections if contains a declared response, a static restriction of search params and protocols, and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ searchParams: { room: '1' }, protocols: ['chat'], exact })
            .respond({ action: 'reject' });

          await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1&other=value`, ['chat', 'json']);
          expect(handler.connections).toHaveLength(1);
          expect(handler.connections[0].searchParams.toString()).toBe('room=1&other=value');
          expect(handler.connections[0].protocols).toEqual(['chat', 'json']);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=2`, ['chat']);
          expect(handler.connections).toHaveLength(1);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=1`, ['json']);
          expect(handler.connections).toHaveLength(1);
        },
      );
    },
  );

  it('should match only specific connections if contains a declared response and asynchronous computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const restriction = vi.fn(async (request: WebSocketInterceptorConnectionRequest) => {
          await Promise.resolve();
          return request.url.endsWith('/rejected');
        });

        const handler = await interceptor.connection().with(restriction).respond({ action: 'reject' });

        await expectWebSocketConnectionToOpen(`${baseURL}/accepted`);
        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToBeRefused(`${baseURL}/rejected`);
        expect(handler.connections).toHaveLength(1);
        expect(handler.connections[0].url).toBe(`${baseURL}/rejected`);

        expect(restriction).toHaveBeenCalledTimes(2);
      },
    );
  });

  it('should match only specific connections if contains a declared response and multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor
          .connection()
          .with({ searchParams: { room: '1' } })
          .with({ protocols: ['chat'] })
          .with((request) => !request.searchParams.has('ignored'))
          .respond({ action: 'reject' });

        await expectWebSocketConnectionToOpen(`${baseURL}?room=1`);
        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(baseURL, ['chat']);
        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(`${baseURL}?room=1&ignored=true`, ['chat']);
        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`, ['chat']);
        expect(handler.connections).toHaveLength(1);
        expect(handler.connections[0].searchParams.toString()).toBe('room=1');
        expect(handler.connections[0].protocols).toEqual(['chat']);
      },
    );
  });
}
