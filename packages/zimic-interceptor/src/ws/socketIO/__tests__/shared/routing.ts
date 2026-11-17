import type { HttpSchema } from '@zimic/http';
import { waitFor } from '@zimic/utils/time';
import { WEB_SOCKET_CLOSE_CODES } from '@zimic/utils/ws';
import type { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it } from 'vitest';

import { usingHttpInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';
import {
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { createSocketIOProtocol } from '../../factory';
import type { SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestSavingOptions,
} from './utils';

type PlainSchema = WebSocketSchema<{ '/': { message: string } }>;

type HealthSchema = HttpSchema<{
  '/health': { GET: { response: { 204: { body: null } } } };
}>;

export function declareRoutingSocketIOProtocolTests(options: SharedSocketIOProtocolTestsOptions) {
  const { type, getBaseURL: getServerBaseURL, WebSocketTransport } = options;

  let baseURL: string;
  let polling: SocketIOPollingInterceptor;

  beforeEach(() => {
    baseURL = getSocketIOBaseURL(getServerBaseURL());
    polling = createSocketIOPollingInterceptor(type, baseURL);
  });

  function getSocketIOInterceptorOptions(
    protocolOptions?: SocketIOProtocolOptions,
    savingOptions?: SocketIOTestSavingOptions,
  ) {
    return createSocketIOInterceptorOptions({ type, baseURL, polling }, protocolOptions, savingOptions);
  }

  // Local interceptors serve Socket.IO over polling only, so only remote WebSocket clients connect.
  if (type === 'remote') {
    describe('Overlapping base URLs', () => {
      it('should connect WebSocket clients through the interceptor of their Socket.IO path', async () => {
        const nestedBaseURL = `${baseURL}/nested`;
        const nestedPolling = createSocketIOPollingInterceptor(type, nestedBaseURL);

        await usingWebSocketInterceptor<AnySchema>(
          {
            type,
            baseURL: nestedBaseURL,
            protocol: createSocketIOProtocol({ polling: nestedPolling }),
          },
          async (nestedInterceptor) => {
            // Started last, so it would claim the connection as its newest holder if its protocol served the nested path.
            await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
              await usingSocket(nestedBaseURL, { transports: [WebSocketTransport] }, async (socket) => {
                await waitForSocketConnection(socket);

                expect(nestedInterceptor.clients).toHaveLength(1);
                expect(interceptor.clients).toHaveLength(0);
              });
            });
          },
        );
      });

      it('should connect WebSocket clients through the interceptor of their Socket.IO path instead of newer interceptors without a protocol', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          // Started last, so it would hold the connection as its newest holder if the Socket.IO claim did not take
          // precedence.
          await usingWebSocketInterceptor<PlainSchema>({ type, baseURL }, async (plainInterceptor) => {
            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);

              expect(interceptor.clients).toHaveLength(1);
              expect(plainInterceptor.clients).toHaveLength(0);
            });
          });
        });
      });
    });
  }

  describe('WebSocket connections outside the Socket.IO path', () => {
    it('should leave connections to other paths under the base URL to other interceptors', async () => {
      const chatBaseURL = `${baseURL}/chat`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingWebSocketInterceptor<PlainSchema>({ type, baseURL: chatBaseURL }, async (chatInterceptor) => {
          await promiseIfRemote(chatInterceptor.message().respond('pong'), chatInterceptor);

          await usingWebSocketClient<PlainSchema, '/'>(chatBaseURL, async (client) => {
            const messagePromise = waitForWebSocketClientMessage(client);
            client.send('ping');
            await expect(messagePromise).resolves.toBe('pong');

            expect(chatInterceptor.clients).toHaveLength(1);
            expect(interceptor.clients).toHaveLength(0);
          });
        });
      });
    });

    it('should close connections to other paths under the base URL when their interceptor is cleared', async () => {
      const chatBaseURL = `${baseURL}/chat`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        await usingWebSocketInterceptor<PlainSchema>({ type, baseURL: chatBaseURL }, async (chatInterceptor) => {
          await usingWebSocketClient<PlainSchema, '/'>(chatBaseURL, async (client) => {
            await waitFor(() => expect(chatInterceptor.clients).toHaveLength(1));

            const closeEventPromise = waitForWebSocketClientClose(client);
            await promiseIfRemote(chatInterceptor.clear(), chatInterceptor);

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          });
        });
      });
    });

    // Local interceptors let these connections pass through to the network, but the interceptor server is the endpoint
    // of remote connections.
    if (type === 'remote') {
      it('should close connections to other paths under the base URL without other interceptors', async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          const socket = new WebSocket(`${baseURL}/chat`);

          try {
            const closeEvent = await new Promise<CloseEvent>((resolve) => {
              socket.addEventListener('close', resolve, { once: true });
            });

            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
            expect(interceptor.clients).toHaveLength(0);
          } finally {
            socket.close();
          }
        });
      });
    }
  });

  describe('HTTP requests outside the Socket.IO path', () => {
    it('should leave HTTP requests to other paths under the base URL to other interceptors', async () => {
      const httpBaseURL = getServerBaseURL().replace(/^ws/, 'http');

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        await usingHttpInterceptor<HealthSchema>(
          { type, baseURL: httpBaseURL, onUnhandledRequest: { action: 'reject', log: false } },
          async (httpInterceptor) => {
            await httpInterceptor.get('/health').respond({ status: 204, body: null }).times(1);

            const response = await fetch(`${httpBaseURL}/health`);
            expect(response.status).toBe(204);
          },
        );
      });
    });
  });
}
