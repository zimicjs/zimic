import { createPromiseWithResolvers } from '@zimic/utils/data';
import color from 'picocolors';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  expectWebSocketTimesCheckError,
  openWebSocketUntilSettled,
  REFUSED_WEB_SOCKET_EVENT_TYPES,
} from '@tests/utils/webSocket';

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

  describe('Exact number of connections', () => {
    // Browsers open one connection to a host at a time, so a remote handshake waits for the previous one to be decided
    // and two connections are never matched concurrently. Local connections never reach the network.
    if (!(platform === 'browser' && type === 'remote')) {
      it('should not match more than an exact number of limited connections when connections are handled concurrently', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
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

            const attempts = await Promise.all([
              openWebSocketUntilSettled(baseURL),
              openWebSocketUntilSettled(baseURL),
            ]);

            for (const { socket } of attempts) {
              socket.close();
            }

            expect(attempts.map(({ eventTypes }) => eventTypes)).toEqual(
              expect.arrayContaining([['open'], REFUSED_WEB_SOCKET_EVENT_TYPES]),
            );
            expect(limitedHandler.connections).toHaveLength(1);
            expect(fallbackHandler.connections).toHaveLength(1);

            await limitedHandler.checkTimes();
          },
        );
      });
    }

    it('should match an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await handler.checkTimes();

          await handler.times(2);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await handler.times(3);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();
        },
      );
    });

    it.each<{ action: 'accept' | 'reject'; expectedEventTypes: string[] }>([
      { action: 'accept', expectedEventTypes: ['open'] },
      { action: 'reject', expectedEventTypes: REFUSED_WEB_SOCKET_EVENT_TYPES },
    ])(
      'should match an exact number of limited connections decided by a computed response ($action)',
      async ({ action, expectedEventTypes }) => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .respond(() => ({ action }))
              .times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 connection, but got 0.',
              expectedNumberOfMatches: 1,
            });

            const { socket, eventTypes } = await openWebSocketUntilSettled(baseURL);
            socket.close();

            expect(eventTypes).toEqual(expectedEventTypes);

            await handler.checkTimes();
          },
        );
      },
    );

    it('should match less than an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 0.',
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 1.',
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await handler.times(4);
          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 4 connections, but got 3.',
            expectedNumberOfMatches: 4,
          });
        },
      );
    });

    it('should not match more than an exact number of limited connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 2.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 3.',
            expectedNumberOfMatches: 1,
          });
        },
      );
    });

    it('should match exactly zero connections', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(0);

          await handler.checkTimes();

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 0 connections, but got 1.',
            expectedNumberOfMatches: 0,
          });
        },
      );
    });
  });

  describe('Range number of connections', () => {
    it('should match the minimum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(0, 3);

          await handler.checkTimes();

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();
        },
      );
    });

    it('should match less than the minimum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(2, 3);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 connections, but got 0.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 connections, but got 1.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();
        },
      );
    });

    it('should match the maximum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(2, 3);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);

          await handler.checkTimes();
        },
      );
    });

    it('should not match more than the maximum number of connections limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(2, 3);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 connections, but got 4.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });
        },
      );
    });

    it('should match the exact number of connections limited in a range including zero', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(0, 1);

          await handler.checkTimes();

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 0 and at most 1 connection, but got 2.',
            expectedNumberOfMatches: { min: 0, max: 1 },
          });
        },
      );
    });

    it('should match the exact number of connections limited in a unitary range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(1, 1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: { min: 1, max: 1 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await handler.checkTimes();

          // The over-limit connection opens because the handler no longer rejects it.
          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 2.',
            expectedNumberOfMatches: { min: 1, max: 1 },
          });
        },
      );
    });

    it('should match the exact number of connections limited in a non-unitary range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' }).times(2, 2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 0.',
            expectedNumberOfMatches: { min: 2, max: 2 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 1.',
            expectedNumberOfMatches: { min: 2, max: 2 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);
          await handler.checkTimes();

          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 connections, but got 3.',
            expectedNumberOfMatches: { min: 2, max: 2 },
          });
        },
      );
    });
  });

  describe('Unmatched connections', () => {
    describe('Restrictions', () => {
      it('should not include the connections unmatched due to restrictions if not saving connections', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: false } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat'] })
              .respond({ action: 'reject' })
              .times(1);

            const expectedMessage = [
              'Expected exactly 1 matching connection, but got 0.',
              '',
              'Tip: use `connectionSaving.enabled: true` in your interceptor for more details about the unmatched ' +
                'connections.',
            ].join('\n');

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: expectedMessage,
              expectedNumberOfMatches: 1,
            });

            await expectWebSocketConnectionToOpen(baseURL);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: expectedMessage,
              expectedNumberOfMatches: 1,
            });
          },
        );
      });

      it('should consider connections unmatched due to computed restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with(() => false)
              .respond({ action: 'reject' })
              .times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching connection, but got 0.',
              expectedNumberOfMatches: 1,
            });

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
              expectedNumberOfMatches: 1,
            });
          },
        );
      });

      // No WebSocket counterpart for "should consider requests unmatched due to headers restrictions in times check errors":
      // connection restrictions receive only the URL and requested subprotocols, because browsers cannot set handshake
      // headers.

      it('should consider connections unmatched due to search params restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: { room: '1' } })
              .respond({ action: 'reject' })
              .times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching connection, but got 0.',
              expectedNumberOfMatches: 1,
            });

            const { socket: firstSocket } = await openWebSocketUntilSettled(baseURL);
            firstSocket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${firstSocket.url}`,
                '     Search params:',
                `       ${color.green('- { "room": "1" }')}`,
                `       ${color.red('+ {}')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });

            const { socket: secondSocket } = await openWebSocketUntilSettled(`${baseURL}?room=2&tag=a&tag=b`);
            secondSocket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${firstSocket.url}`,
                '     Search params:',
                `       ${color.green('- { "room": "1" }')}`,
                `       ${color.red('+ {}')}`,
                '',
                `2: ${secondSocket.url}`,
                '     Search params:',
                `       ${color.green('- { "room": "1" }')}`,
                `       ${color.red('+ { "room": "2", "tag": [ "a", "b" ] }')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });
          },
        );
      });

      // No WebSocket counterpart for "should consider requests unmatched due to JSON body requests in times check errors":
      // a handshake has no body.

      // No WebSocket counterpart for "should consider requests unmatched due to search params matched requests in times check errors":
      // a handshake has no body.

      // No WebSocket counterpart for "should consider requests unmatched due to form data matched requests in times check errors":
      // a handshake has no body.

      // No WebSocket counterpart for "should consider requests unmatched due to blob body requests in times check errors":
      // a handshake has no body.

      // No WebSocket counterpart for "should consider requests unmatched due to plain-text matched requests in times check errors":
      // a handshake has no body.

      it('should consider connections unmatched due to protocols restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ protocols: ['chat'] })
              .respond({ action: 'reject' })
              .times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching connection, but got 0.',
              expectedNumberOfMatches: 1,
            });

            const { socket: firstSocket } = await openWebSocketUntilSettled(baseURL);
            firstSocket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${firstSocket.url}`,
                '     Protocols:',
                `       ${color.green('- [ "chat" ]')}`,
                `       ${color.red('+ []')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });

            const { socket: secondSocket } = await openWebSocketUntilSettled(baseURL, ['json']);
            secondSocket.close();

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: [
                'Expected exactly 1 matching connection, but got 0.',
                '',
                'Connections evaluated by this handler:',
                '',
                `  ${color.green('- Expected')}`,
                `  ${color.red('+ Received')}`,
                '',
                `1: ${firstSocket.url}`,
                '     Protocols:',
                `       ${color.green('- [ "chat" ]')}`,
                `       ${color.red('+ []')}`,
                '',
                `2: ${secondSocket.url}`,
                '     Protocols:',
                `       ${color.green('- [ "chat" ]')}`,
                `       ${color.red('+ [ "json" ]')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });
          },
        );
      });

      it('should consider connections unmatched due to search params and protocols restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: { room: '1' }, protocols: ['chat'] })
              .respond({ action: 'reject' })
              .times(1);

            const { socket } = await openWebSocketUntilSettled(`${baseURL}?room=2`, ['json']);
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
                `       ${color.red('+ { "room": "2" }')}`,
                '     Protocols:',
                `       ${color.green('- [ "chat" ]')}`,
                `       ${color.red('+ [ "json" ]')}`,
              ].join('\n'),
              expectedNumberOfMatches: 1,
            });
          },
        );
      });
    });

    describe('Response declarations', () => {
      // No WebSocket counterpart for "should consider requests unmatched due to missing a response declaration in times check errors":
      // a connection handler without a response matches and accepts the connection.

      it('should consider connections with restrictions unmatched only due to restrictions if missing a response declaration in times checks', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, connectionSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .connection()
              .with({ searchParams: { room: '1' } })
              .times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching connection, but got 0.',
              expectedNumberOfMatches: 1,
            });

            const { socket: mismatchingSocket } = await openWebSocketUntilSettled(baseURL);
            mismatchingSocket.close();

            const expectedUnmatchedEntry = [
              'Connections evaluated by this handler:',
              '',
              `  ${color.green('- Expected')}`,
              `  ${color.red('+ Received')}`,
              '',
              `1: ${mismatchingSocket.url}`,
              '     Search params:',
              `       ${color.green('- { "room": "1" }')}`,
              `       ${color.red('+ {}')}`,
            ];

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: ['Expected exactly 1 matching connection, but got 0.', '', ...expectedUnmatchedEntry].join('\n'),
              expectedNumberOfMatches: 1,
            });

            await expectWebSocketConnectionToOpen(`${baseURL}?room=1`);
            await handler.checkTimes();

            await expectWebSocketConnectionToOpen(`${baseURL}?room=1`);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: ['Expected exactly 1 matching connection, but got 2.', '', ...expectedUnmatchedEntry].join('\n'),
              expectedNumberOfMatches: 1,
            });
          },
        );
      });
    });

    // No WebSocket counterpart for "should consider requests unmatched due to missing a response declaration when no requests are expected in times checks":
    // a connection handler without a response matches and accepts the connection.

    it('should not consider connections unmatched due to being cleared in times checks', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, connectionSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.connection().effect(vi.fn());

          await handler.clear();

          const { socket: socketWhileCleared } = await openWebSocketUntilSettled(baseURL);
          socketWhileCleared.close();

          await handler.times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToOpen(baseURL);

          expect(handler.connections).toHaveLength(1);
          await handler.checkTimes();
        },
      );
    });
  });

  it('should reset the limits on the number of connections when cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, connectionSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.connection().respond({ action: 'reject' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 connection, but got 0.',
          expectedNumberOfMatches: 1,
        });

        await handler.clear();

        await handler.checkTimes();

        await handler.respond({ action: 'reject' }).times(1);

        await expectWebSocketConnectionToBeRefused(baseURL);
        await handler.checkTimes();

        await handler.clear();

        await handler.checkTimes();

        await expectWebSocketConnectionToOpen(baseURL);
        await handler.checkTimes();
      },
    );
  });
}
