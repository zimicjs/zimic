import { createWebSocketInterceptor, type WebSocketInterceptorType } from '@zimic/interceptor/experimental/ws';
import { waitFor } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import NodeWebSocket, { type RawData } from 'ws';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import type { UserWebSocketMessage, UserWebSocketSchema } from '@tests/types/schema/webSocket';

describe('ws client (Node.js)', () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeAll(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = NodeWebSocket as unknown as typeof globalThis.WebSocket;
  });

  afterAll(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  describe.each<WebSocketInterceptorType>(['local', 'remote'])("(type '%s')", (type) => {
    const baseURL =
      type === 'local' ? 'ws://localhost:4004' : `ws://localhost:${ZIMIC_SERVER_PORT}/ws-client-${crypto.randomUUID()}`;

    const interceptor = createWebSocketInterceptor<UserWebSocketSchema>({
      type,
      baseURL,
      messageSaving: { enabled: true },
    });

    type WSClient = NodeWebSocket | WebSocket;

    function isNodeWebSocket(socket: WSClient): socket is NodeWebSocket {
      return 'once' in socket;
    }

    function waitForWsOpen(socket: WSClient) {
      if (!isNodeWebSocket(socket)) {
        return new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => resolve(), { once: true });
          socket.addEventListener('error', (event) => reject(event), { once: true });
          socket.addEventListener('close', (event) => reject(event), { once: true });
        });
      }

      return new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
        socket.once('close', reject);
      });
    }

    function closeWs(socket: WSClient) {
      if (socket.readyState === NodeWebSocket.CLOSED) {
        return Promise.resolve();
      }

      if (!isNodeWebSocket(socket)) {
        return new Promise<void>((resolve, reject) => {
          socket.addEventListener('close', () => resolve(), { once: true });
          socket.addEventListener('error', (event) => reject(event), { once: true });

          socket.close();
        });
      }

      return new Promise<void>((resolve, reject) => {
        socket.once('close', () => resolve());
        socket.once('error', reject);

        socket.close();
      });
    }

    function waitForWsUserCreationResponse(socket: WSClient) {
      if (!isNodeWebSocket(socket)) {
        return new Promise<UserWebSocketMessage<'user:create:success'>>((resolve, reject) => {
          socket.addEventListener(
            'message',
            (event) => {
              try {
                const message = JSON.parse(event.data as string) as UserWebSocketMessage<'user:create:success'>;
                resolve(message);
              } catch (error) {
                reject(error);
              }
            },
            { once: true },
          );
        });
      }

      return new Promise<UserWebSocketMessage<'user:create:success'>>((resolve, reject) => {
        socket.once('message', (data: RawData) => {
          try {
            const dataBuffer = Array.isArray(data)
              ? Buffer.concat(data)
              : data instanceof ArrayBuffer
                ? Buffer.from(data)
                : data;
            const stringifiedData = dataBuffer.toString();
            const message = JSON.parse(stringifiedData) as UserWebSocketMessage<'user:create:success'>;
            resolve(message);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    beforeAll(async () => {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe('node');
    });

    afterEach(async () => {
      await interceptor.checkTimes();
      await Promise.resolve(interceptor.clear());

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    afterAll(async () => {
      await interceptor.stop();
      expect(interceptor.isRunning).toBe(false);
    });

    it('should support handling and responding to user creation messages', async () => {
      const creationInput = {
        name: 'Name',
        email: 'email@email.com',
        password: crypto.randomUUID(),
        birthDate: new Date().toISOString(),
      };

      const requestMessage: UserWebSocketMessage<'user:create'> = {
        type: 'user:create',
        data: creationInput,
      };

      const creationHandler = await interceptor
        .message()
        .with(requestMessage)
        .respond((message) => ({
          type: 'user:create:success',
          data: {
            id: crypto.randomUUID(),
            name: message.data.name,
            email: message.data.email,
            birthDate: message.data.birthDate,
          },
        }))
        .times(1);

      const socket =
        type === 'local' ? new globalThis.WebSocket(interceptor.baseURL) : new NodeWebSocket(interceptor.baseURL);

      try {
        await waitForWsOpen(socket);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const responsePromise = waitForWsUserCreationResponse(socket);

        socket.send(JSON.stringify(requestMessage));

        const response = await responsePromise;
        expect(response).toMatchObject({
          type: 'user:create:success',
          data: {
            name: creationInput.name,
            email: creationInput.email,
            birthDate: creationInput.birthDate,
          },
        });

        expect(creationHandler.messages).toHaveLength(1);
        expect(creationHandler.messages[0].data).toEqual(requestMessage);
      } finally {
        await closeWs(socket);
      }
    });
  });
});
