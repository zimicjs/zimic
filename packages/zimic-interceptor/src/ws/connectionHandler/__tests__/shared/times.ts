import { createPromiseWithResolvers } from '@zimic/utils/data';
import color from 'picocolors';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { expectWebSocketTimesCheckError, openWebSocketUntilSettled } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketConnectionHandlerTestOptions } from './utils';

export function declareTimesWebSocketConnectionHandlerTests(
  options: SharedWebSocketConnectionHandlerTestOptions & {
    type: WebSocketInterceptorType;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL } = options;

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

  async function openAndCloseWebSocket(url: string, protocols?: string[]) {
    const { socket, eventTypes } = await openWebSocketUntilSettled(url, protocols);
    socket.close();
    return eventTypes;
  }

  describe('Exact number of connections', () => {
    // Browsers open one connection to a host at a time, so a remote handshake waits for the previous one to be decided
    // and two connections are never matched concurrently. Local connections never reach the network.
    if (!(platform === 'browser' && type === 'remote')) {
      it('should not match more than an exact number of limited connections when connections are handled concurrently', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            let numberOfEvaluatedConnections = 0;
            const restrictionsReadyPromise = createPromiseWithResolvers<void>();

            const fallbackHandler = await interceptor.connection().effect(vi.fn());

            const limitedHandler = await interceptor
              .connection()
              .with(async () => {
                numberOfEvaluatedConnections++;

                if (numberOfEvaluatedConnections === 2) {
                  restrictionsReadyPromise.resolve();
                }

                await restrictionsReadyPromise;
                return true;
              })
              .respond({ action: 'reject' })
              .times(1);

            const eventTypes = await Promise.all([openAndCloseWebSocket(baseURL), openAndCloseWebSocket(baseURL)]);

            expect(eventTypes).toEqual(expect.arrayContaining([['open'], ['error', 'close']]));
            expect(limitedHandler.connections).toHaveLength(1);
            expect(fallbackHandler.connections).toHaveLength(1);

            await limitedHandler.checkTimes();
          },
        );
      });
    }

    it('should match an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMessages: 1,
          });

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['error', 'close']);

          await handler.checkTimes();
        },
      );
    });

    it('should match less than an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().times(2);

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['open']);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 1.',
            expectedNumberOfMessages: 2,
          });
        },
      );
    });

    it('should not match more than an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['error', 'close']);
          await handler.checkTimes();

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['open']);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 2.',
            expectedNumberOfMessages: 1,
          });
        },
      );
    });

    it('should match exactly zero connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(0);

          await handler.checkTimes();

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['open']);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 0 connections, but got 1.',
            expectedNumberOfMessages: 0,
          });
        },
      );
    });
  });

  describe('Range number of connections', () => {
    it('should match the minimum and maximum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1, 2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 1 and at most 2 connections, but got 0.',
            expectedNumberOfMessages: { min: 1, max: 2 },
          });

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['error', 'close']);
          await handler.checkTimes();

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['error', 'close']);
          await handler.checkTimes();
        },
      );
    });

    it('should not match more than the maximum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(0, 1);

          expect(await openAndCloseWebSocket(baseURL)).toEqual(['error', 'close']);
          expect(await openAndCloseWebSocket(baseURL)).toEqual(['open']);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 0 and at most 1 connection, but got 2.',
            expectedNumberOfMessages: { min: 0, max: 1 },
          });
        },
      );
    });
  });

  describe('Unmatched connections', () => {
    describe('Restrictions', () => {
      it('should not include the connections unmatched due to restrictions if not saving messages', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: false } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat'] })
              .respond({ action: 'reject' })
              .times(1);

            expect(await openAndCloseWebSocket(baseURL)).toEqual(['open']);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Tip: use `messageSaving.enabled: true` in your interceptor for more details about the unmatched ' +
                  'connections.',
              ].join('\n'),
              expectedNumberOfMessages: 1,
            });
          },
        );
      });

      it('should consider connections unmatched due to computed restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with(() => false)
              .respond({ action: 'reject' })
              .times(1);

            const { socket } = await openWebSocketUntilSettled(baseURL);
            socket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${socket.url}`,
                '     Computed restriction:',
                `       ${color.green('- return true')}`,
                `       ${color.red('+ return false')}`,
              ].join('\n'),
              expectedNumberOfMessages: 1,
            });
          },
        );
      });

      it('should consider connections unmatched due to search params restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: { room: '1' } })
              .respond({ action: 'reject' })
              .times(1);

            const { socket } = await openWebSocketUntilSettled(`${baseURL}?room=2&tag=a&tag=b`);
            socket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${socket.url}`,
                '     Search params:',
                `       ${color.green('- { "room": "1" }')}`,
                `       ${color.red('+ { "room": "2", "tag": [ "a", "b" ] }')}`,
              ].join('\n'),
              expectedNumberOfMessages: 1,
            });
          },
        );
      });

      it('should consider connections unmatched due to protocols restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat'] })
              .respond({ action: 'reject' })
              .times(1);

            const { socket } = await openWebSocketUntilSettled(baseURL, ['json']);
            socket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${socket.url}`,
                '     Protocols:',
                `       ${color.green('- [ "chat" ]')}`,
                `       ${color.red('+ [ "json" ]')}`,
              ].join('\n'),
              expectedNumberOfMessages: 1,
            });
          },
        );
      });
    });
  });

  it('should reset the limits on the number of connections when cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 connection, but got 0.',
          expectedNumberOfMessages: 1,
        });

        await handler.clear();

        await handler.checkTimes();
      },
    );
  });
}
