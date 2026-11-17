import type { HttpSchema } from '@zimic/http';
import type { WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it } from 'vitest';

import { usingHttpInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';

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
    });
  }

  describe('WebSocket connections outside the Socket.IO path', () => {
    it('should leave connections to other paths under the base URL to other interceptors', async () => {
      const chatBaseURL = `${baseURL}/chat`;

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingWebSocketInterceptor<PlainSchema>({ type, baseURL: chatBaseURL }, async (chatInterceptor) => {
          const socket = new WebSocket(chatBaseURL);

          try {
            await new Promise<void>((resolve) => {
              socket.addEventListener('open', () => resolve(), { once: true });
            });

            expect(chatInterceptor.clients).toHaveLength(1);
            expect(interceptor.clients).toHaveLength(0);
          } finally {
            socket.close();
          }
        });
      });
    });
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
