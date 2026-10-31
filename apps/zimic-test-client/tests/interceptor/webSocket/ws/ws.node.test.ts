import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';
import { waitFor } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import NodeWebSocket, { type RawData } from 'ws';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import type { UserWebSocketMessage, UserWebSocketSchema } from '@tests/types/schema/webSocket';

// Remote-only: local interceptors only intercept sockets created through `globalThis.WebSocket`, not sockets created
// directly with the `ws` package.
describe("ws client (Node.js, type 'remote')", () => {
  const interceptor = createWebSocketInterceptor<UserWebSocketSchema>({
    type: 'remote',
    baseURL: `ws://localhost:${ZIMIC_SERVER_PORT}/ws-client-${crypto.randomUUID()}`,
    messageSaving: { enabled: true },
  });

  function waitForWsOpen(socket: NodeWebSocket) {
    return new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
      socket.once('close', reject);
    });
  }

  function closeWs(socket: NodeWebSocket) {
    return new Promise<void>((resolve, reject) => {
      socket.once('close', () => resolve());
      socket.once('error', reject);

      socket.close();
    });
  }

  function waitForWsUserCreationResponse(socket: NodeWebSocket) {
    return new Promise<UserWebSocketMessage<'user:create:success'>>((resolve) => {
      function messageListener(data: RawData) {
        const dataBuffer = Array.isArray(data)
          ? Buffer.concat(data)
          : data instanceof ArrayBuffer
            ? Buffer.from(data)
            : data;
        const message = JSON.parse(dataBuffer.toString()) as UserWebSocketMessage;

        if (message.type === 'user:create:success') {
          socket.off('message', messageListener);
          resolve(message);
        }
      }

      socket.on('message', messageListener);
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

    const socket = new NodeWebSocket(interceptor.baseURL);

    try {
      await waitForWsOpen(socket);

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(1);
      });

      for (let index = 0; index < 2; index++) {
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
      }

      expect(creationHandler.messages).toHaveLength(2);
      expect(creationHandler.messages[0].data).toEqual(requestMessage);
      expect(creationHandler.messages[1].data).toEqual(requestMessage);
    } finally {
      await closeWs(socket);
    }
  });
});
