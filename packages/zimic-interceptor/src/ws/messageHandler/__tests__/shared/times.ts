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

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    receivedBlobMessageRepresentation: string;
  },
) {
  const { type, receivedBlobMessageRepresentation, startServer, stopServer, getBaseURL } = options;

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
            expectedNumberOfMessages: 1,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await response;

            await handler.checkTimes();
          });
        },
      );
    });

    it('should match less than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 0.',
            expectedNumberOfMessages: 2,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await response;

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 2 messages, but got 1.',
              expectedNumberOfMessages: 2,
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
                expectedNumberOfMessages: 1,
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
                expectedNumberOfMessages: 0,
              }),
            );
          });
        },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum and maximum number of messages limited in a range', async () => {
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
            expectedNumberOfMessages: { min: 2, max: 3 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await response;

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected at least 2 and at most 3 messages, but got 1.',
              expectedNumberOfMessages: { min: 2, max: 3 },
            });
          });
        },
      );
    });

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

          const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1);

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected at least 0 and at most 1 message, but got 2.',
                expectedNumberOfMessages: { min: 0, max: 1 },
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
            expectedNumberOfMessages: { min: 1, max: 1 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const response = waitForWebSocketClientMessage(client);

            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

            await handler.checkTimes();

            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

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
              expectedNumberOfMessages: 1,
            });

            await usingWebSocketClient<Schema>(baseURL, async (client) => {
              const response = waitForWebSocketClientMessage(client);

              client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
              expect(await response).toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

              await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: expectedMessage,
                expectedNumberOfMessages: 1,
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
                  expectedNumberOfMessages: 1,
                }),
              );
            });
          },
        );
      });
      it('should show unmatched JSON messages in times check errors', async () => {
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
                  expectedNumberOfMessages: 1,
                }),
              );
            });
          },
        );
      });

      it('should show unmatched array buffer messages in times check errors', async () => {
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
                  expectedNumberOfMessages: 1,
                }),
              );
            });
          },
        );
      });

      it('should show unmatched blob messages in times check errors', async () => {
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
                    `1: ${receivedBlobMessageRepresentation}`,
                    '     Data:',
                    `       ${color.green("- Blob { type: 'application/octet-stream', size: 1 }")}`,
                    `       ${color.red(`+ ${receivedBlobMessageRepresentation}`)}`,
                  ].join('\n'),
                  expectedNumberOfMessages: 1,
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
                      '     Sender restriction:',
                      `       ${color.green('- true')}`,
                      `       ${color.red('+ false')}`,
                    ].join('\n'),
                    expectedNumberOfMessages: 1,
                  }),
                );
              });
            });
          },
        );
      });
    });
  });

  it('should reset the limits on the number of messages when cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        handler.clear();

        await handler.checkTimes();
      },
    );
  });
}
