import { createWebSocketInterceptor, type WebSocketInterceptorType } from '@zimic/interceptor/experimental/ws';
import { waitFor } from '@zimic/utils/time';
import { EventEmitter } from 'node:events';
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
        const nativeSocket = socket;

        return new Promise<UserWebSocketMessage<'user:create:success'>>((resolve, reject) => {
          function messageListener(event: Event) {
            try {
              const messageEvent = event as MessageEvent;
              const message = JSON.parse(messageEvent.data as string) as UserWebSocketMessage;

              if (message.type === 'user:create:success') {
                nativeSocket.removeEventListener('message', messageListener);
                resolve(message);
              }
            } catch (error) {
              nativeSocket.removeEventListener('message', messageListener);
              reject(error);
            }
          }

          nativeSocket.addEventListener('message', messageListener);
        });
      }

      const nodeSocket = socket;

      return new Promise<UserWebSocketMessage<'user:create:success'>>((resolve, reject) => {
        function messageListener(data: RawData) {
          try {
            const dataBuffer = Array.isArray(data)
              ? Buffer.concat(data)
              : data instanceof ArrayBuffer
                ? Buffer.from(data)
                : data;
            const stringifiedData = dataBuffer.toString();
            const message = JSON.parse(stringifiedData) as UserWebSocketMessage;

            if (message.type === 'user:create:success') {
              nodeSocket.off('message', messageListener);
              resolve(message);
            }
          } catch (error) {
            nodeSocket.off('message', messageListener);
            reject(error);
          }
        }

        nodeSocket.on('message', messageListener);
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
        .times(2);

      const socket =
        type === 'local' ? new globalThis.WebSocket(interceptor.baseURL) : new NodeWebSocket(interceptor.baseURL);

      try {
        await waitForWsOpen(socket);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const initialMessageListenerCount = isNodeWebSocket(socket) ? socket.listenerCount('message') : undefined;

        for (let index = 0; index < 2; index++) {
          const responsePromise = waitForWsUserCreationResponse(socket);

          if (isNodeWebSocket(socket)) {
            socket.emit(
              'message',
              Buffer.from(JSON.stringify({ type: 'user:delete:success', data: { id: crypto.randomUUID() } })),
              false,
            );
            expect(socket.listenerCount('message')).toBe((initialMessageListenerCount ?? 0) + 1);
          }

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

          if (isNodeWebSocket(socket)) {
            expect(socket.listenerCount('message')).toBe(initialMessageListenerCount);
          }
        }

        expect(creationHandler.messages).toHaveLength(2);
        expect(creationHandler.messages[0].data).toEqual(requestMessage);
        expect(creationHandler.messages[1].data).toEqual(requestMessage);
      } finally {
        await closeWs(socket);
      }
    });

    it('should remove the response listener after a terminal parsing failure', async () => {
      const socket = new EventEmitter() as NodeWebSocket;
      const initialMessageListenerCount = socket.listenerCount('message');
      const responsePromise = waitForWsUserCreationResponse(socket);
      socket.emit('message', Buffer.from('{'), false);

      await expect(responsePromise).rejects.toBeInstanceOf(SyntaxError);
      expect(socket.listenerCount('message')).toBe(initialMessageListenerCount);
    });
  });
});
