import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { expectWebSocketConnectionToBeRefused, expectWebSocketConnectionToOpen } from '@tests/utils/webSocket';

import { InterceptedWebSocketInterceptorConnection } from '../../../interceptor/types/messages';
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
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.connection('/rooms/:roomId').respond({ action: 'reject' }).times(2);

        await expectWebSocketConnectionToOpen(baseURL);
        await expectWebSocketConnectionToOpen(`${baseURL}/rooms`);
        await expectWebSocketConnectionToOpen(`${baseURL}/rooms/1/members`);
        await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/1`);
        await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/2?token=value`);

        await handler.checkTimes();
      });
    });

    it('should match every connection to the interceptor if no path is declared', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.connection().respond({ action: 'reject' }).times(2);

        await expectWebSocketConnectionToBeRefused(baseURL);
        await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/1`);

        await handler.checkTimes();
      });
    });
  });

  describe('By search params', () => {
    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response and a static search params restriction (exact: $exact)',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ searchParams: { room: '1', tag: ['a', 'b'] }, exact })
            .respond({ action: 'reject' })
            .times(1);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=1&tag=a&tag=b&other=value`);
          await expectWebSocketConnectionToOpen(`${baseURL}?room=1&tag=a`);
          await expectWebSocketConnectionToBeRefused(`${baseURL}?tag=a&room=1&tag=b`);

          await handler.checkTimes();
        });
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response and a static search params restriction (exact: $exact)',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ searchParams: new URLSearchParams({ room: '1' }), exact })
            .respond({ action: 'reject' })
            .times(2);

          await expectWebSocketConnectionToOpen(`${baseURL}?room=2`);
          await expectWebSocketConnectionToOpen(baseURL);
          await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`);
          await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1&other=value`);

          await handler.checkTimes();
        });
      },
    );

    it('should match only specific connections if contains a declared response and a computed search params restriction', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor
          .connection()
          .with((connection) => {
            expectTypeOf(connection).toEqualTypeOf<InterceptedWebSocketInterceptorConnection>();
            return new URL(connection.url).searchParams.get('room') === '1';
          })
          .respond({ action: 'reject' })
          .times(1);

        await expectWebSocketConnectionToOpen(`${baseURL}?room=2`);
        await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`);

        await handler.checkTimes();
      });
    });
  });

  describe('By protocols', () => {
    it.each([{ exact: true }])(
      'should match only specific connections if contains a declared response and a static protocols restriction (exact: $exact)',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ protocols: ['chat', 'json'], exact })
            .respond({ action: 'reject' })
            .times(1);

          await expectWebSocketConnectionToOpen(baseURL, ['json', 'chat']);
          await expectWebSocketConnectionToOpen(baseURL, ['chat', 'json', 'other']);
          await expectWebSocketConnectionToBeRefused(baseURL, ['chat', 'json']);

          await handler.checkTimes();
        });
      },
    );

    it.each([{ exact: false }, { exact: undefined }])(
      'should match only specific connections if contains a declared response and a static protocols restriction (exact: $exact)',
      async ({ exact }) => {
        await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
          const handler = await interceptor
            .connection()
            .with({ protocols: ['chat'], exact })
            .respond({ action: 'reject' })
            .times(2);

          await expectWebSocketConnectionToOpen(baseURL);
          await expectWebSocketConnectionToOpen(baseURL, ['json']);
          await expectWebSocketConnectionToBeRefused(baseURL, ['json', 'chat']);
          await expectWebSocketConnectionToBeRefused(baseURL, ['chat']);

          await handler.checkTimes();
        });
      },
    );

    it('should match only specific connections if contains a declared response and a computed protocols restriction', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor
          .connection()
          .with((connection) => connection.protocols[0] === 'chat')
          .respond({ action: 'reject' })
          .times(1);

        await expectWebSocketConnectionToOpen(baseURL, ['json', 'chat']);
        await expectWebSocketConnectionToBeRefused(baseURL, ['chat', 'json']);

        await handler.checkTimes();
      });
    });
  });

  it('should match only specific connections if contains a declared response and asynchronous computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const restriction = vi.fn(async (connection: InterceptedWebSocketInterceptorConnection) => {
        await Promise.resolve();
        return connection.url.endsWith('/rejected');
      });

      const handler = await interceptor.connection().with(restriction).respond({ action: 'reject' }).times(1);

      await expectWebSocketConnectionToOpen(`${baseURL}/accepted`);
      await expectWebSocketConnectionToBeRefused(`${baseURL}/rejected`);

      expect(restriction).toHaveBeenCalledTimes(2);
      await handler.checkTimes();
    });
  });

  it('should match only specific connections if contains a declared response and multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor
        .connection()
        .with({ searchParams: { room: '1' } })
        .with({ protocols: ['chat'] })
        .with((connection) => !connection.url.includes('ignored'))
        .respond({ action: 'reject' })
        .times(1);

      await expectWebSocketConnectionToOpen(`${baseURL}?room=1`);
      await expectWebSocketConnectionToOpen(baseURL, ['chat']);
      await expectWebSocketConnectionToOpen(`${baseURL}?room=1&ignored=true`, ['chat']);
      await expectWebSocketConnectionToBeRefused(`${baseURL}?room=1`, ['chat']);

      await handler.checkTimes();
    });
  });

  // No WebSocket counterpart for the "By headers" and "By body" HTTP groups: connection restrictions receive only the URL
  // and requested subprotocols, because browsers cannot set handshake headers and a handshake has no body.
}
