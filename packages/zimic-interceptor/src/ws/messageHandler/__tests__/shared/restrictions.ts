import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { createBinaryMessage, usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { WebSocketMessageHandlerMessageContext } from '../../types/public';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareRestrictionWebSocketMessageHandlerTests(
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

  it('should match only specific messages if contains static restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'create', body: { text: 'hello' } })
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        await handler.checkTimes();
      });
    });
  });

  it.each([{ exact: true }])(
    'should match only specific messages if contains a static restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        const restriction: ChatMessage = { type: 'create', body: { text: 'hello' } };

        await interceptor.message().with(restriction, { exact }).respond({ type: 'delete', id: 'restricted' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          for (const matchingMessage of [restriction] satisfies ChatMessage[]) {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchingMessage));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
          }

          for (const mismatchingMessage of [
            { type: 'create', body: { text: 'hello', priority: 1 } },
            { type: 'create', body: { text: 'other' } },
            { type: 'delete', id: '1' },
          ] satisfies ChatMessage[]) {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(mismatchingMessage));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          }
        });
      });
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only specific messages if contains a static restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        const restriction: ChatMessage = { type: 'create', body: { text: 'hello' } };

        await interceptor.message().with(restriction, { exact }).respond({ type: 'delete', id: 'restricted' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          for (const matchingMessage of [
            restriction,
            { type: 'create', body: { text: 'hello', priority: 1 } },
          ] satisfies ChatMessage[]) {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(matchingMessage));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
          }

          for (const mismatchingMessage of [
            { type: 'create', body: { text: 'other' } },
            { type: 'delete', id: '1' },
          ] satisfies ChatMessage[]) {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify(mismatchingMessage));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          }
        });
      });
    },
  );

  it.each([{ exact: true }])(
    'should match only specific messages if contains a static text restriction and exact $exact',
    async ({ exact }) => {
      type TextSchema = WebSocketSchema<{
        '/': {
          message: string;
        };
      }>;

      await usingWebSocketInterceptor<TextSchema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond('fallback');

        await interceptor.message().with('content', { exact }).respond('restricted');

        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          const matchedResponse = waitForWebSocketClientMessage(client);
          client.send('content');
          await expect(matchedResponse).resolves.toBe('restricted');

          for (const mismatchingMessage of ['more-content', '"content"', 'cont', '']) {
            const response = waitForWebSocketClientMessage(client);
            client.send(mismatchingMessage);
            await expect(response).resolves.toBe('fallback');
          }
        });
      });
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only specific messages if contains a static text restriction and exact $exact',
    async ({ exact }) => {
      type TextSchema = WebSocketSchema<{
        '/': {
          message: string;
        };
      }>;

      await usingWebSocketInterceptor<TextSchema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond('fallback');

        await interceptor.message().with('content', { exact }).respond('restricted');

        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          for (const matchingMessage of ['content', 'more-content', '"content"']) {
            const response = waitForWebSocketClientMessage(client);
            client.send(matchingMessage);
            await expect(response).resolves.toBe('restricted');
          }

          for (const mismatchingMessage of ['cont', '']) {
            const response = waitForWebSocketClientMessage(client);
            client.send(mismatchingMessage);
            await expect(response).resolves.toBe('fallback');
          }
        });
      });
    },
  );

  it.each([{ exact: true }, { exact: false }])(
    'should not match JSON messages if contains a static text restriction and exact $exact',
    async ({ exact }) => {
      type MixedSchema = WebSocketSchema<{
        '/': {
          message: string | { type: string };
        };
      }>;

      await usingWebSocketInterceptor<MixedSchema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond('fallback');

        const jsonMessage = JSON.stringify({ type: 'content' });

        const handler = await interceptor.message().with(jsonMessage, { exact }).respond('restricted').times(0);

        await usingWebSocketClient<MixedSchema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);
          client.send(jsonMessage);
          await expect(response).resolves.toBe('fallback');

          await handler.checkTimes();
        });
      });
    },
  );

  it('should not match JSON messages if contains static binary restrictions', async () => {
    type BinarySchema = WebSocketSchema<{
      '/': {
        message: { type: 'a' | 'b' } | ArrayBuffer;
      };
    }>;

    await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'a' });

      const handler = await interceptor.message().with(createBinaryMessage(1, 2)).respond({ type: 'b' }).times(0);

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'a' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'a' }));

        await handler.checkTimes();
      });
    });
  });

  it('should not match binary messages if contains static JSON restrictions', async () => {
    type BinarySchema = WebSocketSchema<{
      '/': {
        message: { type: 'a' | 'b' } | ArrayBuffer;
      };
    }>;

    await usingWebSocketInterceptor<BinarySchema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'a' });

      const handler = await interceptor.message().with({}).respond({ type: 'b' }).times(0);

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(createBinaryMessage(1, 2));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'a' }));

        await handler.checkTimes();
      });
    });
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((message: Extract<ChatMessage, { type: 'create' }>) => {
        expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
      });

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with(isCreateMessage)
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });

  it('should match only specific messages if contains boolean computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const effect = vi.fn();

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with((message: ChatMessage): boolean => message.type === 'create' && message.body.text.startsWith('hello'))
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const deleteResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        await expect(deleteResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        const goodbyeResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        await expect(goodbyeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const helloResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(helloResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });

  it('should match only messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await usingWebSocketClient<Schema>(baseURL, async (restrictedClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const [restrictedSender] = interceptor.clients;

            const effect = vi.fn();
            const handler = await interceptor
              .message()
              .from(restrictedSender)
              .effect(effect)
              .respond({ type: 'delete', id: 'restricted' })
              .times(1);

            // The fallback response shows that the message from the other client was handled without matching the
            // restricted handler.
            const otherResponse = waitForWebSocketClientMessage(otherClient);

            otherClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            await expect(otherResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
            expect(effect).not.toHaveBeenCalled();

            const restrictedResponse = waitForWebSocketClientMessage(restrictedClient);

            restrictedClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(restrictedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(effect).toHaveBeenCalledTimes(1);
            expect(effect.mock.calls[0][0]).toEqual({ type: 'create', body: { text: 'restricted' } });
            expect(handler.messages[0].sender).toBe(restrictedSender);
            expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });

            await handler.checkTimes();
          });
        });
      },
    );
  });

  it.each([{ exact: true }])(
    'should match only messages from a restricted sender if contains a static search params restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await interceptor
          .message()
          .from({ searchParams: { room: 'general' }, exact })
          .respond({ type: 'delete', id: 'restricted' });

        await usingWebSocketClient<Schema>(`${baseURL}?room=general`, async (client) => {
          const response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
        });

        for (const mismatchingSearchParams of ['room=general&other=value', 'room=random', '']) {
          await usingWebSocketClient<Schema>(`${baseURL}?${mismatchingSearchParams}`, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          });
        }
      });
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only messages from a restricted sender if contains a static search params restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await interceptor
          .message()
          .from({ searchParams: { room: 'general' }, exact })
          .respond({ type: 'delete', id: 'restricted' });

        for (const matchingSearchParams of ['room=general', 'room=general&other=value']) {
          await usingWebSocketClient<Schema>(`${baseURL}?${matchingSearchParams}`, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
          });
        }

        for (const mismatchingSearchParams of ['room=random', '']) {
          await usingWebSocketClient<Schema>(`${baseURL}?${mismatchingSearchParams}`, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          });
        }
      });
    },
  );

  it.each([{ exact: true }])(
    'should match only messages from a restricted sender if contains a static protocol restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await interceptor
          .message()
          .from({ protocols: ['chat'], exact })
          .respond({ type: 'delete', id: 'restricted' });

        await usingWebSocketClient<Schema>(baseURL, { protocols: ['chat'] }, async (client) => {
          const response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
        });

        for (const mismatchingProtocols of [['chat', 'json'], ['json'], []]) {
          await usingWebSocketClient<Schema>(baseURL, { protocols: mismatchingProtocols }, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          });
        }
      });
    },
  );

  it.each([{ exact: false }, { exact: undefined }])(
    'should match only messages from a restricted sender if contains a static protocol restriction and exact $exact',
    async ({ exact }) => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        await interceptor
          .message()
          .from({ protocols: ['chat'], exact })
          .respond({ type: 'delete', id: 'restricted' });

        for (const matchingProtocols of [['chat'], ['json', 'chat']]) {
          await usingWebSocketClient<Schema>(baseURL, { protocols: matchingProtocols }, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
          });
        }

        for (const mismatchingProtocols of [['json'], []]) {
          await usingWebSocketClient<Schema>(baseURL, { protocols: mismatchingProtocols }, async (client) => {
            const response = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
          });
        }
      });
    },
  );

  it('should match only messages from the last restricted sender if a client is replaced by a static restriction', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      await usingWebSocketClient<Schema>(`${baseURL}?room=first`, async (firstClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        await usingWebSocketClient<Schema>(`${baseURL}?room=second`, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const [firstSender] = interceptor.clients;
          expect(firstSender.searchParams.get('room')).toBe('first');

          await interceptor
            .message()
            .from(firstSender)
            .from({ searchParams: { room: 'second' } })
            .respond({ type: 'delete', id: 'restricted' });

          const firstResponse = waitForWebSocketClientMessage(firstClient);
          firstClient.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

          const secondResponse = waitForWebSocketClientMessage(secondClient);
          secondClient.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));
          await expect(secondResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
        });
      });
    });
  });

  it('should match only messages from the last restricted sender if a static restriction is replaced by a client', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      await usingWebSocketClient<Schema>(`${baseURL}?room=first`, async (firstClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        await usingWebSocketClient<Schema>(`${baseURL}?room=second`, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const [, secondSender] = interceptor.clients;
          expect(secondSender.searchParams.get('room')).toBe('second');

          await interceptor
            .message()
            .from({ searchParams: { room: 'first' } })
            .from(secondSender)
            .respond({ type: 'delete', id: 'restricted' });

          const firstResponse = waitForWebSocketClientMessage(firstClient);
          firstClient.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

          const secondResponse = waitForWebSocketClientMessage(secondClient);
          secondClient.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));
          await expect(secondResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));
        });
      });
    });
  });

  it('should match only messages from a restricted sender if contains a computed restriction', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      await usingWebSocketClient<Schema>(baseURL, async (restrictedClient) => {
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        await usingWebSocketClient<Schema>(baseURL, async (otherClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const [restrictedSender, otherSender] = interceptor.clients;

          const restriction = vi.fn(
            (_message: ChatMessage, context: WebSocketMessageHandlerMessageContext<Schema>) =>
              context.sender === restrictedSender,
          );

          const handler = await interceptor
            .message()
            .with(restriction)
            .respond({ type: 'delete', id: 'restricted' })
            .times(1);

          const otherResponse = waitForWebSocketClientMessage(otherClient);
          otherClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));
          await expect(otherResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

          const restrictedResponse = waitForWebSocketClientMessage(restrictedClient);
          restrictedClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));
          await expect(restrictedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

          expect(restriction).toHaveBeenCalledTimes(2);

          const [otherMessage, otherContext] = restriction.mock.calls[0];
          expect(otherMessage).toEqual({ type: 'create', body: { text: 'other' } });
          expect(otherContext.sender).toBe(otherSender);
          expect(otherContext.receiver).toBe(interceptor.server);

          const [restrictedMessage, restrictedContext] = restriction.mock.calls[1];
          expect(restrictedMessage).toEqual({ type: 'create', body: { text: 'restricted' } });
          expect(restrictedContext.sender).toBe(restrictedSender);
          expect(restrictedContext.receiver).toBe(interceptor.server);

          await handler.checkTimes();
        });
      });
    });
  });

  // No WebSocket message counterpart for "should match only specific requests if contains a declared response, a static
  // restriction of search params and headers, and exact $exact": WebSocket frames have no URL or headers.

  it('should match only messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const effect = vi.fn();

      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'create' })
        .with(
          (message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> =>
            message.type === 'create' && message.body.text.startsWith('hello'),
        )
        .effect(effect)
        .respond({ type: 'delete', id: 'restricted' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const unmatchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        await expect(unmatchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));
        expect(effect).not.toHaveBeenCalled();

        const matchedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(matchedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'restricted' }));

        expect(effect).toHaveBeenCalledTimes(1);
        await handler.checkTimes();
      });
    });
  });
}
