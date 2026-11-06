import { HttpSearchParams } from '@zimic/utils/http';
import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  createBinaryMessage,
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorConnectionRequest } from '../../types/messages';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<
  { type: 'create'; body: { text: string; priority?: number } } | { type: 'delete'; id: string }
>;
type TextSchema = WebSocketSchema<string>;
type BinarySchema = WebSocketSchema<Blob>;

export function declareRestrictionWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  // No WebSocket counterpart for "should support intercepting requests having partial headers restrictions": WebSocket
  // frames have no headers.

  // No WebSocket counterpart for "should support intercepting requests having partial search params restrictions":
  // WebSocket frames have no URL, which belongs to the connection handshake.

  it('should support intercepting messages having static restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .respond({ type: 'delete', id: '1' })
          .times(1),
        interceptor,
      );

      await promiseIfRemote(
        interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const probeResponse = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

        // Messages on a socket are delivered in order, so the probe response arriving first means that the unmatched
        // message got no response.
        client.send(JSON.stringify({ type: 'delete', id: '1' }));

        await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages having exact JSON restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } }, { exact: true })
          .effect(effect)
          .times(1),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello', priority: 1 } }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith({ type: 'create', body: { text: 'hello' } }, expect.any(Object));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages having non-exact JSON restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } }, { exact: false })
          .effect(effect)
          .times(2),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello', priority: 1 } }));

        // Messages on a socket are handled in order, so the effect running only for the matching messages means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(2);
        });
        expect(effect).toHaveBeenNthCalledWith(1, { type: 'create', body: { text: 'hello' } }, expect.any(Object));
        expect(effect).toHaveBeenNthCalledWith(
          2,
          { type: 'create', body: { text: 'hello', priority: 1 } },
          expect.any(Object),
        );
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  // No WebSocket counterpart for "should support intercepting requests having exact body form data restrictions":
  // WebSocket frames carry only text or bytes, with no form data encoding.

  // No WebSocket counterpart for "should support intercepting requests having non-exact body form data restrictions":
  // WebSocket frames carry only text or bytes, with no form data encoding.

  // No WebSocket counterpart for "should support intercepting requests having exact body search params restrictions":
  // WebSocket frames carry only text or bytes, with no URL-encoded form encoding.

  // No WebSocket counterpart for "should support intercepting requests having non-exact body search params restrictions":
  // WebSocket frames carry only text or bytes, with no URL-encoded form encoding.

  it('should support intercepting messages having exact text restrictions', async () => {
    await usingWebSocketInterceptor<TextSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor.message().with('content', { exact: true }).effect(effect).times(1),
        interceptor,
      );

      await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
        client.send('more-content');
        client.send('cont');
        client.send('');
        client.send('content');

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith('content', expect.any(Object));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  // Unlike HTTP text bodies, which match if they include the restriction, a text frame has no structure to contain a
  // part of, so non-exact text restrictions match only the same text.
  it('should support intercepting messages having non-exact text restrictions', async () => {
    await usingWebSocketInterceptor<TextSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor.message().with('content', { exact: false }).effect(effect).times(1),
        interceptor,
      );

      await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
        client.send('more-content');
        client.send('cont');
        client.send('');
        client.send('content');

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith('content', expect.any(Object));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages having exact blob restrictions', async () => {
    await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      const binaryBlob = new Blob([createBinaryMessage(1, 2)]);

      await promiseIfRemote(
        interceptor.message().with(binaryBlob, { exact: true }).effect(effect).times(1),
        interceptor,
      );

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        client.send(new Blob([new Uint8Array([1, 2, 3])]));
        client.send(new Blob([createBinaryMessage(3, 4)]));
        client.send(new Blob([new Uint8Array([1])]));
        client.send(binaryBlob);

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(await readBytes(effect.mock.calls[0][0] as Blob | ArrayBuffer)).toEqual([1, 2]);
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  // Unlike HTTP blob bodies, which match if they include the restriction, a binary frame is opaque bytes without a
  // structure to contain a part of, so non-exact binary restrictions match only the same bytes.
  it('should support intercepting messages having non-exact blob restrictions', async () => {
    await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      const binaryBlob = new Blob([createBinaryMessage(1, 2)]);

      await promiseIfRemote(
        interceptor.message().with(binaryBlob, { exact: false }).effect(effect).times(1),
        interceptor,
      );

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        client.send(new Blob([new Uint8Array([1, 2, 3])]));
        client.send(new Blob([createBinaryMessage(3, 4)]));
        client.send(new Blob([new Uint8Array([1])]));
        client.send(binaryBlob);

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched messages did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(await readBytes(effect.mock.calls[0][0] as Blob | ArrayBuffer)).toEqual([1, 2]);
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages having computed restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      function isCreateMessage(message: MessageSchema): message is Extract<MessageSchema, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((message: Extract<MessageSchema, { type: 'create' }>) => {
        expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
      });

      await promiseIfRemote(interceptor.message().with(isCreateMessage).effect(effect).times(1), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'delete', id: '1' }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched message did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith({ type: 'create', body: { text: 'hello' } }, expect.any(Object));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const unrestrictedEffect = vi.fn();
        await promiseIfRemote(interceptor.message().effect(unrestrictedEffect), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const handler = await promiseIfRemote(
              interceptor.message().from(interceptor.clients[0]).respond({ type: 'delete', id: '1' }).times(1),
              interceptor,
            );

            const secondMessageListener = vi.fn();
            secondClient.addEventListener('message', secondMessageListener);

            secondClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            // The restricted handler has precedence, so the unrestricted effect running means that it did not match.
            await waitFor(() => {
              expect(unrestrictedEffect).toHaveBeenCalledTimes(1);
            });
            expect(secondMessageListener).not.toHaveBeenCalled();

            const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
            firstClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
            expect(unrestrictedEffect).toHaveBeenCalledTimes(1);
            expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
            expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });
          });
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should support intercepting messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create' })
          .with((message): message is Extract<MessageSchema, { type: 'create' }> =>
            message.body.text.startsWith('hello'),
          )
          .effect(effect)
          .times(1),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched message did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith({ type: 'create', body: { text: 'hello' } }, expect.any(Object));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should reset restrictions when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
        interceptor,
      );

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'probe' } })
          .respond({ type: 'delete', id: 'probe' }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const probeResponse = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are delivered in order, so the probe response arriving first means that the unmatched
        // message got no response.
        client.send(JSON.stringify({ type: 'create', body: { text: 'probe' } }));

        await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

        await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '2' }).times(1), interceptor);

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  describe('Connections', () => {
    // No WebSocket counterpart for "By headers": connection restrictions receive only the URL and requested subprotocols,
    // because browsers cannot set handshake headers.

    // No WebSocket counterpart for "By body": a handshake has no body.

    it('should support intercepting connections having partial search params restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor
            .connection()
            .with({ searchParams: { token: 'expired' } })
            .respond({ action: 'reject' })
            .times(1),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(`${baseURL}?token=valid`);
        await expectWebSocketConnectionToBeRefused(`${baseURL}?token=expired&room=1`);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should support intercepting connections having partial protocols restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor
            .connection()
            .with({ protocols: ['legacy'] })
            .respond({ action: 'reject' })
            .times(1),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(baseURL, ['chat']);
        await expectWebSocketConnectionToBeRefused(baseURL, ['chat', 'legacy']);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should support intercepting connections having static restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor
            .connection()
            .with({ searchParams: { token: 'expired' }, protocols: ['legacy'] })
            .respond({ action: 'reject' })
            .times(1),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(`${baseURL}?token=valid`, ['legacy']);
        await expectWebSocketConnectionToOpen(`${baseURL}?token=expired`, ['chat']);
        await expectWebSocketConnectionToBeRefused(`${baseURL}?token=expired`, ['legacy']);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should support intercepting connections having computed restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const restriction = vi.fn((request: WebSocketInterceptorConnectionRequest) => {
          return request.searchParams.has('blocked');
        });

        await promiseIfRemote(
          interceptor.connection().with(restriction).respond({ action: 'reject' }).times(1),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(baseURL, ['chat']);
        await expectWebSocketConnectionToBeRefused(`${baseURL}?blocked`);

        expect(restriction).toHaveBeenCalledTimes(2);
        expect(restriction).toHaveBeenNthCalledWith(1, {
          url: new URL(baseURL).href,
          protocols: ['chat'],
          searchParams: new HttpSearchParams(),
          pathParams: {},
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should support intercepting connections satisfying multiple restrictions', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor
            .connection()
            .with({ protocols: ['legacy'] })
            .with((request) => request.searchParams.has('blocked'))
            .respond({ action: 'reject' })
            .times(1),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(baseURL, ['legacy']);
        await expectWebSocketConnectionToOpen(`${baseURL}?blocked`, ['chat']);
        await expectWebSocketConnectionToBeRefused(`${baseURL}?blocked`, ['legacy']);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should reset restrictions when cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor
            .connection()
            .with({ protocols: ['legacy'] })
            .respond({ action: 'reject' }),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(baseURL);

        await promiseIfRemote(handler.clear().respond({ action: 'reject' }).times(1), interceptor);

        await expectWebSocketConnectionToBeRefused(baseURL);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });
  });
}
