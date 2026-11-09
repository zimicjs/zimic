import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import color from 'picocolors';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  expectWebSocketTimesCheckError,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { UnhandledMessageStrategy, WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
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

  describe('Exact number of messages', () => {
    it('should not match more than an exact number of limited messages when messages are handled concurrently', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          let numberOfEvaluatedMessages = 0;
          const restrictionsReadyPromise = createPromiseWithResolvers<void>();
          const limitedEffect = vi.fn();

          await interceptor.message().respond({ type: 'delete', id: 'fallback' });

          const limitedHandler = await interceptor
            .message()
            .with(async () => {
              numberOfEvaluatedMessages++;
              if (numberOfEvaluatedMessages === 2) {
                restrictionsReadyPromise.resolve();
              }

              await restrictionsReadyPromise;
              return true;
            })
            .effect(limitedEffect)
            .respond({ type: 'delete', id: 'limited' })
            .times(1);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const responses = collectWebSocketClientMessages(client);

            const message: Schema = { type: 'create', body: { text: 'overlap' } };
            client.send(JSON.stringify(message));
            client.send(JSON.stringify(message));

            await waitFor(() => expect(responses).toHaveLength(2));

            expect(responses).toEqual(
              expect.arrayContaining([
                JSON.stringify({ type: 'delete', id: 'limited' }),
                JSON.stringify({ type: 'delete', id: 'fallback' }),
              ]),
            );
            expect(limitedEffect).toHaveBeenCalledTimes(1);

            await limitedHandler.checkTimes();
          });
        },
      );
    });

    it('should match an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            let response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            await response;

            await handler.checkTimes();

            await handler.times(2);

            response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            await response;

            await handler.checkTimes();

            await handler.times(3);

            response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'three' } }));
            await response;

            await handler.checkTimes();
          });
        },
      );
    });

    // No WebSocket message counterpart for "should match an exact number of limited connections decided by a computed
    // response ($action)": a message has no handshake to accept or reject.

    it('should match less than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 0.',
            expectedNumberOfMatches: 2,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            let response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            await response;

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 2 messages, but got 1.',
              expectedNumberOfMatches: 2,
            });

            response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            await response;

            await handler.checkTimes();

            await handler.times(4);

            response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'three' } }));
            await response;

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 4 messages, but got 3.',
              expectedNumberOfMatches: 4,
            });
          });
        },
      );
    });

    it('should not match more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 message, but got 2.',
                expectedNumberOfMatches: 1,
              }),
            );

            const probeResponse = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

            // The next message received is the probe response, so the over-limit message got no response.
            expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          });
        },
      );
    });

    it('should match exactly zero messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0);

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 0 messages, but got 1.',
                expectedNumberOfMatches: 0,
              }),
            );
          });
        },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3);

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            for (const text of ['one', 'two', 'three']) {
              const response = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'create', body: { text } }));
              await response;

              await handler.checkTimes();
            }
          });
        },
      );
    });

    it('should match less than the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 0.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await response;

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected at least 2 and at most 3 messages, but got 1.',
              expectedNumberOfMatches: { min: 2, max: 3 },
            });
          });
        },
      );
    });

    it('should match the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            for (const text of ['one', 'two', 'three']) {
              const response = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'create', body: { text } }));
              await response;
            }

            await handler.checkTimes();
          });
        },
      );
    });

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            for (const text of ['one', 'two', 'three']) {
              const response = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'create', body: { text } }));
              expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));
            }

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'four' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected at least 2 and at most 3 messages, but got 4.',
                expectedNumberOfMatches: { min: 2, max: 3 },
              }),
            );

            const probeResponse = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

            // The next message received is the probe response, so the over-limit message got no response.
            expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          });
        },
      );
    });

    it('should match the exact number of messages limited in a range including zero', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1);

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected at least 0 and at most 1 message, but got 2.',
                expectedNumberOfMatches: { min: 0, max: 1 },
              }),
            );

            const probeResponse = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

            // The next message received is the probe response, so the over-limit message got no response.
            expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          });
        },
      );
    });

    it('should match the exact number of messages limited in a unitary range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1, 1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMatches: { min: 1, max: 1 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 message, but got 2.',
                expectedNumberOfMatches: { min: 1, max: 1 },
              }),
            );

            const probeResponse = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

            // The next message received is the probe response, so the over-limit message got no response.
            expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          });
        },
      );
    });

    it('should match the exact number of messages limited in a non-unitary range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 0.',
            expectedNumberOfMatches: { min: 2, max: 2 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            let response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 2 messages, but got 1.',
              expectedNumberOfMatches: { min: 2, max: 2 },
            });

            response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'three' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 2 messages, but got 3.',
                expectedNumberOfMatches: { min: 2, max: 2 },
              }),
            );

            const probeResponse = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

            // The next message received is the probe response, so the over-limit message got no response.
            expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
          });
        },
      );
    });
  });

  describe('Unmatched messages', () => {
    describe('Restrictions', () => {
      it('should not include the messages unmatched due to restrictions if not saving messages', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: false } },
          async (interceptor) => {
            await interceptor.message().respond({ type: 'delete', id: 'fallback' });

            const handler = await interceptor
              .message()
              .with((message) => message.type === 'delete')
              .respond({ type: 'delete', id: 'restricted' })
              .times(1);

            const expectedMessage = [
              'Expected exactly 1 matching message, but got 0.',
              '',
              'Tip: use `messageSaving.enabled: true` in your interceptor for more details about the unmatched messages.',
            ].join('\n');

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: expectedMessage,
              expectedNumberOfMatches: 1,
            });

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              const response = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
              expect(await response).toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

              await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: expectedMessage,
                expectedNumberOfMatches: 1,
              });
            });
          },
        );
      });

      it('should consider messages unmatched due to computed restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with((message) => message.type === 'delete')
              .respond({ type: 'delete', id: '1' })
              .times(1);

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: { "type": "create", "body": { "text": "hello" } }',
                    '     Computed restriction:',
                    `       ${color.green('- return true')}`,
                    `       ${color.red('+ return false')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      // No WebSocket message counterpart for "should consider requests unmatched due to headers restrictions in times
      // check errors": WebSocket frames have no headers.

      // No WebSocket message counterpart for "should consider connections unmatched due to search params restrictions
      // in times check errors": WebSocket frames have no URL.

      // No WebSocket message counterpart for "should consider requests unmatched due to search params requests in times
      // check errors": WebSocket frames have no URL.

      it('should consider messages unmatched due to JSON data messages in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with({ type: 'delete' })
              .respond({ type: 'delete', id: '1' })
              .times(1);

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: { "type": "create", "body": { "text": "hello" } }',
                    '     Data:',
                    `       ${color.green('- { "type": "delete" }')}`,
                    `       ${color.red('+ { "type": "create", "body": { "text": "hello" } }')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      it('should consider messages unmatched due to exact JSON data messages in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with({ type: 'create', body: { text: 'hello' } }, { exact: true })
              .respond({ type: 'delete', id: '1' })
              .times(1);

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello', priority: 1 } }));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: { "type": "create", "body": { "text": "hello", "priority": "1" } }',
                    '     Data:',
                    `       ${color.green('- { "type": "create", "body": { "text": "hello" } }')}`,
                    `       ${color.red('+ { "type": "create", "body": { "text": "hello", "priority": "1" } }')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      it('should consider messages unmatched due to array buffer data messages in times check errors', async () => {
        await usingWebSocketInterceptor<WebSocketSchema<ArrayBuffer>>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with(createBinaryMessage(1, 2))
              .respond(createBinaryMessage(5, 6))
              .times(1);

            await usingWebSocketClient<WebSocketSchema<ArrayBuffer>>(baseURL, async (client) => {
              client.send(createBinaryMessage(3, 4));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: ArrayBuffer { byteLength: 2 }',
                    '     Data:',
                    `       ${color.green('- ArrayBuffer { byteLength: 2 }')}`,
                    `       ${color.red('+ ArrayBuffer { byteLength: 2 }')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      // No WebSocket message counterpart for "should consider requests unmatched due to search params matched requests
      // in times check errors": WebSocket frames carry only text or binary data.

      // No WebSocket message counterpart for "should consider requests unmatched due to form data matched requests in
      // times check errors": WebSocket frames carry only text or binary data.

      it('should consider messages unmatched due to blob data messages in times check errors', async () => {
        await usingWebSocketInterceptor<WebSocketSchema<Blob>>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const restrictedBlob = new Blob(['1'], { type: 'application/octet-stream' });
            const blob = new Blob(['blob'], { type: 'text/plain' });

            const handler = await interceptor
              .message()
              .with(restrictedBlob)
              .respond(new Blob(['response']))
              .times(1);

            await usingWebSocketClient<WebSocketSchema<Blob>>(baseURL, async (client) => {
              client.send(blob);

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: ArrayBuffer { byteLength: 4 }',
                    '     Data:',
                    `       ${color.green("- Blob { type: 'application/octet-stream', size: 1 }")}`,
                    `       ${color.red('+ ArrayBuffer { byteLength: 4 }')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      it('should consider messages unmatched due to plain-text matched messages in times check errors', async () => {
        await usingWebSocketInterceptor<WebSocketSchema<string>>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().with('example').respond('response').times(1);

            await usingWebSocketClient<WebSocketSchema<string>>(baseURL, async (client) => {
              client.send('text');

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: text',
                    '     Data:',
                    `       ${color.green('- example')}`,
                    `       ${color.red('+ text')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      it('should consider messages unmatched due to typed array data messages in times check errors', async () => {
        await usingWebSocketInterceptor<WebSocketSchema<Uint8Array<ArrayBuffer>>>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor
              .message()
              .with(new Uint8Array([1, 2]))
              .respond(new Uint8Array([5, 6]))
              .times(1);

            await usingWebSocketClient<WebSocketSchema<Uint8Array<ArrayBuffer>>>(baseURL, async (client) => {
              client.send(new Uint8Array([3, 4]));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: [
                    'Expected exactly 1 matching message, but got 0.',
                    '',
                    'Messages evaluated by this handler:',
                    '',
                    `  ${color.green('- Expected')}`,
                    `  ${color.red('+ Received')}`,
                    '',
                    '1: ArrayBuffer { byteLength: 2 }',
                    '     Data:',
                    `       ${color.green('- Uint8Array { byteLength: 2 }')}`,
                    `       ${color.red('+ ArrayBuffer { byteLength: 2 }')}`,
                  ].join('\n'),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });

      it('should consider messages unmatched due to sender restrictions in times check errors', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            await usingWebSocketClient<Schema>(baseURL, async () => {
              await waitFor(() => {
                expect(interceptor.clients).toHaveLength(1);
              });

              await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
                await waitFor(() => {
                  expect(interceptor.clients).toHaveLength(2);
                });

                const [restrictedSender] = interceptor.clients;

                const handler = await interceptor
                  .message()
                  .from(restrictedSender)
                  .respond({ type: 'delete', id: 'restricted' })
                  .times(1);

                otherClient.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

                await waitFor(() =>
                  expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                    message: [
                      'Expected exactly 1 matching message, but got 0.',
                      '',
                      'Messages evaluated by this handler:',
                      '',
                      `  ${color.green('- Expected')}`,
                      `  ${color.red('+ Received')}`,
                      '',
                      '1: { "type": "create", "body": { "text": "hello" } }',
                      '     Sender:',
                      `       ${color.green('- client from handler.from()')}`,
                      `       ${color.red('+ another client')}`,
                    ].join('\n'),
                    expectedNumberOfMatches: 1,
                  }),
                );
              });
            });
          },
        );
      });

      // No WebSocket message counterpart for "should consider connections unmatched due to protocols restrictions in
      // times check errors": subprotocols are negotiated in the handshake, not per message.

      // No WebSocket message counterpart for "should consider connections unmatched due to search params and protocols
      // restrictions in times check errors": WebSocket frames have no URL, and subprotocols are negotiated in the
      // handshake.

      // No WebSocket message counterpart for "should consider requests unmatched due to search params and headers
      // restrictions in times check errors": WebSocket frames have no URL or headers.
    });

    describe('Response declarations', () => {
      // No WebSocket message counterpart for "should consider requests unmatched due to missing a response declaration
      // in times check errors": a WebSocket message needs no reply, so a message handler without a declared response
      // matches the message and sends nothing.

      it('should consider messages with restrictions unmatched only due to restrictions if missing a response declaration in times checks', async () => {
        await usingWebSocketInterceptor<Schema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (interceptor) => {
            const handler = await interceptor.message().with({ type: 'delete' }).times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching message, but got 0.',
              expectedNumberOfMatches: 1,
            });

            const expectedUnmatchedEntry = [
              'Messages evaluated by this handler:',
              '',
              `  ${color.green('- Expected')}`,
              `  ${color.red('+ Received')}`,
              '',
              '1: { "type": "create", "body": { "text": "hello" } }',
              '     Data:',
              `       ${color.green('- { "type": "delete" }')}`,
              `       ${color.red('+ { "type": "create", "body": { "text": "hello" } }')}`,
            ];

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: ['Expected exactly 1 matching message, but got 0.', '', ...expectedUnmatchedEntry].join(
                    '\n',
                  ),
                  expectedNumberOfMatches: 1,
                }),
              );

              client.send(JSON.stringify({ type: 'delete', id: '1' }));

              await waitFor(() => handler.checkTimes());

              client.send(JSON.stringify({ type: 'delete', id: '2' }));

              await waitFor(() =>
                expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                  message: ['Expected exactly 1 matching message, but got 2.', '', ...expectedUnmatchedEntry].join(
                    '\n',
                  ),
                  expectedNumberOfMatches: 1,
                }),
              );
            });
          },
        );
      });
    });

    // No WebSocket message counterpart for "should consider requests unmatched due to missing a response declaration
    // when no requests are expected in times checks": a WebSocket message needs no reply, so a message handler without a
    // declared response matches the message and sends nothing.

    it('should not consider messages unmatched due to being cleared in times checks', async () => {
      const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

          await handler.clear();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(1);
            });

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });

            await handler.times(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 message, but got 0.',
              expectedNumberOfMatches: 1,
            });

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            await handler.checkTimes();
          });
        },
      );
    });
  });

  it('should reset the limits on the number of messages when cleared', async () => {
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMatches: 1,
        });

        await handler.clear();

        await handler.checkTimes();

        await handler.respond({ type: 'delete', id: '1' }).times(1);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          await response;

          await handler.checkTimes();

          await handler.clear();

          await handler.checkTimes();

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });

          await handler.checkTimes();
        });
      },
    );
  });
}
