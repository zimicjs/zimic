import {
  createWebSocketInterceptor,
  type WebSocketInterceptorPlatform,
  type WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { waitFor } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import type { UserWebSocketMessage, UserWebSocketSchema } from '@tests/types/schema/webSocket';

import { declareWebSocketInterceptorTests } from './interceptor';

export interface ClientTestOptions {
  platform: WebSocketInterceptorPlatform;
}

export interface ClientTestOptionsByWorkerType extends ClientTestOptions {
  type: WebSocketInterceptorType;
}

export function declareClientTests(options: ClientTestOptions) {
  const interceptorTypes: WebSocketInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("WebSocket interceptor (type '%s')", (type) => {
    declareWebSocketInterceptorTests({ ...options, type });
  });
}

function getNativeClientBaseURL(type: WebSocketInterceptorType) {
  return type === 'local'
    ? 'ws://localhost:4003'
    : `ws://localhost:${ZIMIC_SERVER_PORT}/native-client-${crypto.randomUUID()}`;
}

export async function openNativeWebSocket(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', (event) => reject(event), { once: true });
    socket.addEventListener('close', (event) => reject(event), { once: true });
  });
}

export async function closeNativeWebSocket(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('close', () => resolve(), { once: true });
    socket.addEventListener('error', (event) => reject(event), { once: true });

    socket.close();
  });
}

async function waitForNativeUserCreationResponse(socket: WebSocket) {
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

export function declareNativeWebSocketClientTests(options: ClientTestOptions) {
  const interceptorTypes: WebSocketInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("Native WebSocket client (type '%s')", (type) => {
    const interceptor = createWebSocketInterceptor<UserWebSocketSchema>({
      type,
      baseURL: getNativeClientBaseURL(type),
      messageSaving: { enabled: true },
    });

    beforeAll(async () => {
      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);
      expect(interceptor.platform).toBe(options.platform);
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

      const socket = new WebSocket(interceptor.baseURL);

      try {
        await openNativeWebSocket(socket);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const responsePromise = waitForNativeUserCreationResponse(socket);

        socket.send(JSON.stringify(requestMessage));

        const response = await responsePromise;
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:success'>>();
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
        await closeNativeWebSocket(socket);
      }
    });
  });
}
