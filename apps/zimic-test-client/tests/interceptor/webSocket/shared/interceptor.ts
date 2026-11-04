import { JSONSerialized } from '@zimic/http';
import {
  createWebSocketInterceptor,
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptor,
  WebSocketInterceptorClient,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { closeWebSocketClient } from '@zimic/utils/ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import {
  ConflictError,
  Notification,
  NotFoundError,
  User,
  UserCreationInput,
  UserUpdateInput,
  ValidationError,
} from '@tests/types/schema/entities';
import {
  BinaryWebSocketSchema,
  UserWebSocketSchema,
  NotificationWebSocketSchema,
  UserWebSocketMessage,
  NotificationWebSocketMessage,
} from '@tests/types/schema/webSocket';
import { serializeUser } from '@tests/utils/schema';

import {
  ClientTestOptionsByWorkerType,
  ClientTestWebSocket,
  ClientTestWebSocketCloseEvent,
  ClientTestWebSocketMessageEvent,
} from './client';

function getUserBaseURL(type: WebSocketInterceptorType) {
  return type === 'local' ? 'ws://localhost:4000' : `ws://localhost:${ZIMIC_SERVER_PORT}/user-${crypto.randomUUID()}`;
}

function getNotificationBaseURL(type: WebSocketInterceptorType) {
  return type === 'local'
    ? 'ws://localhost:4001'
    : `ws://localhost:${ZIMIC_SERVER_PORT}/notification-${crypto.randomUUID()}`;
}

function getBinaryBaseURL(type: WebSocketInterceptorType) {
  return type === 'local' ? 'ws://localhost:4002' : `ws://localhost:${ZIMIC_SERVER_PORT}/binary-${crypto.randomUUID()}`;
}

async function waitForResponseMessage<
  Schema extends UserWebSocketSchema | NotificationWebSocketSchema,
  ResponseMessageType extends Schema['type'],
>(socket: ClientTestWebSocket<Schema>, responseMessageType: ResponseMessageType) {
  return new Promise<Extract<Schema, { type: ResponseMessageType }>>((resolve) => {
    function messageListener(event: ClientTestWebSocketMessageEvent<Schema>) {
      const message = JSON.parse(event.data);

      if (message.type === responseMessageType) {
        socket.removeEventListener('message', messageListener);
        resolve(message);
      }
    }

    socket.addEventListener('message', messageListener);
  });
}

async function sendAndWaitForResponse<ResponseMessageType extends UserWebSocketSchema['type']>(
  socket: ClientTestWebSocket<UserWebSocketSchema>,
  message: UserWebSocketSchema,
  responseMessageType: ResponseMessageType,
) {
  const responsePromise = waitForResponseMessage(socket, responseMessageType);
  socket.send(JSON.stringify(message));
  return responsePromise;
}

async function waitForBinaryMessage(socket: ClientTestWebSocket<BinaryWebSocketSchema>) {
  return new Promise<BinaryWebSocketSchema>((resolve) => {
    function messageListener(event: ClientTestWebSocketMessageEvent<BinaryWebSocketSchema>) {
      socket.removeEventListener('message', messageListener);
      resolve(event.data);
    }

    socket.addEventListener('message', messageListener);
  });
}

// Node `Buffer`s, received by `ws` sockets with their default binary type, are `Uint8Array`s.
async function readBytes(data: BinaryWebSocketSchema) {
  if (data instanceof Blob) {
    return Array.from(new Uint8Array(await data.arrayBuffer()));
  }

  if (ArrayBuffer.isView(data)) {
    return Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  return Array.from(new Uint8Array(data));
}

export function declareWebSocketInterceptorTests({
  platform,
  type,
  defaultBinaryMessageType,
  openSocket,
}: ClientTestOptionsByWorkerType) {
  const userInterceptor = createWebSocketInterceptor<UserWebSocketSchema>({
    type,
    baseURL: getUserBaseURL(type),
    messageSaving: { enabled: true },
  });

  const notificationInterceptor = createWebSocketInterceptor<NotificationWebSocketSchema>({
    type,
    baseURL: getNotificationBaseURL(type),
    messageSaving: { enabled: true },
  });

  const binaryInterceptor = createWebSocketInterceptor<BinaryWebSocketSchema>({
    type,
    baseURL: getBinaryBaseURL(type),
    messageSaving: { enabled: true },
  });

  const interceptors = [userInterceptor, notificationInterceptor, binaryInterceptor];

  let userSockets: ClientTestWebSocket<UserWebSocketSchema>[] = [];
  let notificationSockets: ClientTestWebSocket<NotificationWebSocketSchema>[] = [];
  let binarySocket: ClientTestWebSocket<BinaryWebSocketSchema>;

  function expectMessagedClients<Schema extends UserWebSocketSchema | NotificationWebSocketSchema>(
    interceptor: WebSocketInterceptor<Schema>,
    notifiedClients: WebSocketInterceptorClient<Schema>[],
    expectedClientMessage: Schema,
  ) {
    for (const client of interceptor.clients) {
      if (notifiedClients.includes(client)) {
        expect(client.messages).toHaveLength(1);
        expect(client.messages[0].data).toEqual(expectedClientMessage);
        expect(client.messages[0].sender).toBe(client);
        expect(client.messages[0].receiver).toBe(interceptor.server);
      } else {
        expect(client.messages).toHaveLength(0);
      }
    }
  }

  beforeAll(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);
        expect(interceptor.platform).toBe(platform);
      }),
    );
  });

  beforeEach(async () => {
    await Promise.resolve(userInterceptor.clear());
    await Promise.resolve(notificationInterceptor.clear());
    await Promise.resolve(binaryInterceptor.clear());

    userSockets = [
      await openSocket<UserWebSocketSchema>(userInterceptor.baseURL),
      await openSocket<UserWebSocketSchema>(userInterceptor.baseURL),
    ];

    notificationSockets = [
      await openSocket<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
      await openSocket<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
    ];

    binarySocket = await openSocket<BinaryWebSocketSchema>(binaryInterceptor.baseURL);

    await waitFor(() => {
      expect(userInterceptor.clients).toHaveLength(userSockets.length);
      expect(notificationInterceptor.clients).toHaveLength(notificationSockets.length);
      expect(binaryInterceptor.clients).toHaveLength(1);
    });
  });

  afterEach(async () => {
    try {
      await Promise.all(
        interceptors.map(async (interceptor) => {
          await interceptor.checkTimes();
        }),
      );
    } finally {
      const sockets = [...userSockets, ...notificationSockets, binarySocket];
      await Promise.all(sockets.map((socket) => closeWebSocketClient(socket)));

      await waitFor(() => {
        expect(userInterceptor.clients).toHaveLength(0);
        expect(notificationInterceptor.clients).toHaveLength(0);
        expect(binaryInterceptor.clients).toHaveLength(0);
      });
    }
  });

  afterAll(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
      }),
    );
  });

  describe('Connection listeners', () => {
    it('should notify a listener once per connection with the connected client', async () => {
      const listener = vi.fn<(client: WebSocketInterceptorClient<UserWebSocketSchema>) => void>();
      userInterceptor.on('connection', listener);

      const sockets: ClientTestWebSocket<UserWebSocketSchema>[] = [];

      try {
        for (const index of [0, 1]) {
          sockets.push(await openSocket<UserWebSocketSchema>(userInterceptor.baseURL));
          await waitFor(() => expect(listener).toHaveBeenCalledTimes(index + 1));
          expect(listener).toHaveBeenNthCalledWith(index + 1, userInterceptor.clients[userSockets.length + index]);
        }

        const userId = crypto.randomUUID();
        const response: UserWebSocketMessage<'user:delete:success'> = {
          type: 'user:delete:success',
          data: { id: userId },
        };
        await userInterceptor.message().with({ type: 'user:delete' }).respond(response).times(sockets.length);

        for (const socket of sockets) {
          await expect(
            sendAndWaitForResponse(socket, { type: 'user:delete', data: { id: userId } }, 'user:delete:success'),
          ).resolves.toEqual(response);
        }

        expect(listener).toHaveBeenCalledTimes(sockets.length);
      } finally {
        userInterceptor.off('connection', listener);
        await Promise.all(sockets.map((socket) => closeWebSocketClient(socket)));
      }
    });

    it('should stop notifying a connection listener after it is removed', async () => {
      const listener = vi.fn<(client: WebSocketInterceptorClient<UserWebSocketSchema>) => void>();
      const remainingListener = vi.fn<(client: WebSocketInterceptorClient<UserWebSocketSchema>) => void>();
      userInterceptor.on('connection', listener);
      userInterceptor.on('connection', remainingListener);

      const sockets: ClientTestWebSocket<UserWebSocketSchema>[] = [];

      try {
        sockets.push(await openSocket<UserWebSocketSchema>(userInterceptor.baseURL));
        await waitFor(() => expect(remainingListener).toHaveBeenCalledOnce());
        expect(listener).toHaveBeenCalledExactlyOnceWith(userInterceptor.clients[userSockets.length]);

        userInterceptor.off('connection', listener);

        sockets.push(await openSocket<UserWebSocketSchema>(userInterceptor.baseURL));
        await waitFor(() => expect(remainingListener).toHaveBeenCalledTimes(2));
        expect(listener).toHaveBeenCalledOnce();
        expect(remainingListener).toHaveBeenLastCalledWith(userInterceptor.clients[userSockets.length + 1]);
      } finally {
        userInterceptor.off('connection', listener);
        userInterceptor.off('connection', remainingListener);
        await Promise.all(sockets.map((socket) => closeWebSocketClient(socket)));
      }
    });

    it('should notify a one-time listener only for the first connection', async () => {
      const listener = vi.fn<(client: WebSocketInterceptorClient<UserWebSocketSchema>) => void>();
      const remainingListener = vi.fn<(client: WebSocketInterceptorClient<UserWebSocketSchema>) => void>();
      userInterceptor.once('connection', listener);
      userInterceptor.on('connection', remainingListener);

      const sockets: ClientTestWebSocket<UserWebSocketSchema>[] = [];

      try {
        sockets.push(await openSocket<UserWebSocketSchema>(userInterceptor.baseURL));
        await waitFor(() => expect(remainingListener).toHaveBeenCalledOnce());
        expect(listener).toHaveBeenCalledExactlyOnceWith(userInterceptor.clients[userSockets.length]);

        sockets.push(await openSocket<UserWebSocketSchema>(userInterceptor.baseURL));
        await waitFor(() => expect(remainingListener).toHaveBeenCalledTimes(2));
        expect(listener).toHaveBeenCalledOnce();
        expect(remainingListener).toHaveBeenLastCalledWith(userInterceptor.clients[userSockets.length + 1]);
      } finally {
        userInterceptor.off('connection', listener);
        userInterceptor.off('connection', remainingListener);
        await Promise.all(sockets.map((socket) => closeWebSocketClient(socket)));
      }
    });
  });

  describe('Users', () => {
    const user: User = {
      id: crypto.randomUUID(),
      name: 'Name',
      email: 'email@email.com',
      birthDate: new Date(),
    };

    describe('User creation', () => {
      const creationInput: UserCreationInput = {
        name: user.name,
        email: user.email,
        password: crypto.randomUUID(),
        birthDate: new Date().toISOString(),
      };

      it('should support passively observing user creation messages', async () => {
        const creatorClient = userInterceptor.clients[0];
        const message: UserWebSocketMessage<'user:create'> = {
          type: 'user:create',
          data: creationInput,
        };

        const passiveHandler = await userInterceptor.message().from(creatorClient).with(message).times(1);

        const responseListener = vi.fn();
        userSockets[0].addEventListener('message', responseListener);

        try {
          userSockets[0].send(JSON.stringify(message));

          await waitFor(() => {
            expect(passiveHandler.messages).toHaveLength(1);
          });

          await waitForNot(() => {
            expect(responseListener).toHaveBeenCalled();
          });

          expect(passiveHandler.messages[0]).toEqual<InterceptedWebSocketInterceptorMessage<UserWebSocketSchema>>({
            data: message,
            sender: creatorClient,
            receiver: userInterceptor.server,
          });
          expect(creatorClient.messages).toEqual(passiveHandler.messages);
          expect(userInterceptor.server.messages).toEqual(passiveHandler.messages);
        } finally {
          userSockets[0].removeEventListener('message', responseListener);
        }
      });

      it('should support creating users notifying only the creator', async () => {
        const creatorClient = userInterceptor.clients[0];

        const creationHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({ type: 'user:create', data: creationInput })
          .respond((message) => {
            const createdUser: JSONSerialized<User> = {
              id: crypto.randomUUID(),
              name: message.data.name,
              email: message.data.email,
              birthDate: message.data.birthDate,
            };

            return { type: 'user:create:success', data: createdUser };
          })
          .times(1);

        const otherUserListener = vi.fn();
        userSockets[1].addEventListener('message', otherUserListener);

        try {
          const response = await sendAndWaitForResponse(
            userSockets[0],
            { type: 'user:create', data: creationInput },
            'user:create:success',
          );
          expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:success'>>();

          expect(response.data).toEqual<JSONSerialized<User>>({
            id: expect.any(String) as string,
            name: creationInput.name,
            email: creationInput.email,
            birthDate: creationInput.birthDate,
          });

          await waitForNot(() => {
            expect(otherUserListener).toHaveBeenCalled();
          });

          expectMessagedClients(userInterceptor, [creatorClient], { type: 'user:create', data: creationInput });
          expect(creationHandler.messages).toHaveLength(1);
        } finally {
          userSockets[1].removeEventListener('message', otherUserListener);
        }
      });

      it('should support creating users notifying all users', async () => {
        const creationHandler = await userInterceptor
          .message()
          .with({ type: 'user:create', data: creationInput })
          .effect((message, { receiver }) => {
            const createdUser: JSONSerialized<User> = {
              id: crypto.randomUUID(),
              name: message.data.name,
              email: message.data.email,
              birthDate: message.data.birthDate,
            };
            const response: UserWebSocketMessage<'user:create:success'> = {
              type: 'user:create:success',
              data: createdUser,
            };

            receiver.send(JSON.stringify(response));
          })
          .times(1);

        const responsesPromise = Promise.all(
          userSockets.map((socket) => waitForResponseMessage(socket, 'user:create:success')),
        );

        const message: UserWebSocketMessage<'user:create'> = {
          type: 'user:create',
          data: creationInput,
        };

        userSockets[0].send(JSON.stringify(message));

        const responses = await responsesPromise;
        const response = responses[0];

        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:success'>>();
        expect(responses).toEqual([response, response]);

        expect(response.data).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationInput.name,
          email: creationInput.email,
          birthDate: creationInput.birthDate,
        });

        expect(creationHandler.messages).toHaveLength(1);
      });

      it('should support creating users from a socket sending right after connecting', async () => {
        const creationHandler = await userInterceptor
          .message()
          .with({ type: 'user:create', data: creationInput })
          .respond({ type: 'user:create:success', data: serializeUser(user) })
          .times(1);

        const socket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL);

        try {
          const response = await sendAndWaitForResponse(
            socket,
            { type: 'user:create', data: creationInput },
            'user:create:success',
          );

          expect(response).toEqual({ type: 'user:create:success', data: serializeUser(user) });
          expect(creationHandler.messages).toHaveLength(1);
        } finally {
          await closeWebSocketClient(socket);
        }
      });

      it('should return an error if the input is not valid', async () => {
        // @ts-expect-error Forcing an invalid input
        const invalidInput: UserCreationInput = {};

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid input',
        };

        const creationHandler = await userInterceptor
          .message()
          .with({ type: 'user:create', data: invalidInput })
          .respond({ type: 'user:create:error', data: validationError })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:create', data: invalidInput },
          'user:create:error',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:error'>>();

        expect(response).toEqual({ type: 'user:create:error', data: validationError });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:create',
          data: invalidInput,
        });
        expect(creationHandler.messages).toHaveLength(1);
      });

      it('should return an error if the user already exists', async () => {
        const conflictError: ConflictError = {
          code: 'conflict',
          message: 'User already exists',
        };

        const creationHandler = await userInterceptor
          .message()
          .with({ type: 'user:create', data: creationInput })
          .respond({ type: 'user:create:error', data: conflictError })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:create', data: creationInput },
          'user:create:error',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:error'>>();

        expect(response).toEqual({ type: 'user:create:error', data: conflictError });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:create',
          data: creationInput,
        });
        expect(creationHandler.messages).toHaveLength(1);
      });

      it('should support creating users matched by chained partial restrictions', async () => {
        const creatorClient = userInterceptor.clients[0];
        const message: UserWebSocketMessage<'user:create'> = {
          type: 'user:create',
          data: {
            name: 'Name',
            email: 'email@example.com',
            password: crypto.randomUUID(),
            birthDate: new Date().toISOString(),
          },
        };
        const effectListener = vi.fn();

        await userInterceptor
          .message()
          .from(creatorClient)
          .with({ type: 'user:create' })
          .with({ data: { email: message.data.email } })
          .effect(effectListener)
          .respond((message) => ({
            type: 'user:create:error',
            data: { code: 'validation_error', message: message.data.name },
          }));

        const responsePromise = waitForResponseMessage(userSockets[0], 'user:create:error');
        userSockets[0].send(JSON.stringify(message));

        await expect(responsePromise).resolves.toEqual({
          type: 'user:create:error',
          data: { code: 'validation_error', message: message.data.name },
        });
        expect(effectListener).toHaveBeenCalledExactlyOnceWith(message, {
          sender: creatorClient,
          receiver: userInterceptor.server,
        });
      });
    });

    describe('User update', () => {
      const updateInput: UserUpdateInput = {
        name: 'Updated Name',
        email: 'updated@email.com',
        birthDate: new Date().toISOString(),
      };

      it('should support updating users', async () => {
        const updateHandler = await userInterceptor
          .message()
          .with({
            type: 'user:update',
            data: { id: user.id, ...updateInput },
          })
          .respond((message) => {
            const updatedUser: JSONSerialized<User> = {
              ...serializeUser(user),
              ...message.data,
            };

            return { type: 'user:update:success', data: updatedUser };
          })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:update', data: { id: user.id, ...updateInput } },
          'user:update:success',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:success'>>();

        expect(response.data).toEqual<JSONSerialized<User>>({
          ...serializeUser(user),
          ...updateInput,
        });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:update',
          data: { id: user.id, ...updateInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });

      it('should return an error if user not found', async () => {
        const unknownUserId = crypto.randomUUID();

        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const updateHandler = await userInterceptor
          .message()
          .with({
            type: 'user:update',
            data: { id: unknownUserId, ...updateInput },
          })
          .respond({ type: 'user:update:error', data: notFoundError })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:update', data: { id: unknownUserId, ...updateInput } },
          'user:update:error',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:error'>>();

        expect(response).toEqual({ type: 'user:update:error', data: notFoundError });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:update',
          data: { id: unknownUserId, ...updateInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });

      it('should return an error if input is invalid', async () => {
        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid input',
        };

        const invalidInput: UserUpdateInput = {
          // @ts-expect-error Forcing an invalid input
          invalid: 'invalid',
        };

        const updateHandler = await userInterceptor
          .message()
          .with({
            type: 'user:update',
            data: { id: user.id, ...invalidInput },
          })
          .respond({ type: 'user:update:error', data: validationError })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:update', data: { id: user.id, ...invalidInput } },
          'user:update:error',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:error'>>();

        expect(response).toEqual({ type: 'user:update:error', data: validationError });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:update',
          data: { id: user.id, ...invalidInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });
    });

    describe('User deletion', () => {
      it('should support deleting users by id', async () => {
        const deleteHandler = await userInterceptor
          .message()
          .with({
            type: 'user:delete',
            data: { id: user.id },
          })
          .respond({
            type: 'user:delete:success',
            data: { id: user.id },
          })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:delete', data: { id: user.id } },
          'user:delete:success',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:delete:success'>>();

        expect(response).toEqual({
          type: 'user:delete:success',
          data: { id: user.id },
        });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:delete',
          data: { id: user.id },
        });
        expect(deleteHandler.messages).toHaveLength(1);
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const deleteHandler = await userInterceptor
          .message()
          .with({
            type: 'user:delete',
            data: { id: user.id },
          })
          .respond({ type: 'user:delete:error', data: notFoundError })
          .times(1);

        const response = await sendAndWaitForResponse(
          userSockets[0],
          { type: 'user:delete', data: { id: user.id } },
          'user:delete:error',
        );
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:delete:error'>>();

        expect(response).toEqual({ type: 'user:delete:error', data: notFoundError });

        expectMessagedClients(userInterceptor, [userInterceptor.clients[0]], {
          type: 'user:delete',
          data: { id: user.id },
        });
        expect(deleteHandler.messages).toHaveLength(1);
      });
    });
  });

  describe('Subprotocols', () => {
    it('should support messages from sockets connected with a subprotocol', async () => {
      const userId = crypto.randomUUID();
      const response: UserWebSocketMessage<'user:delete:success'> = {
        type: 'user:delete:success',
        data: { id: userId },
      };
      const deleteHandler = await userInterceptor
        .message()
        .with({ type: 'user:delete', data: { id: userId } })
        .respond(response)
        .times(1);

      const socket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL, 'graphql-transport-ws');

      try {
        expect(socket.protocol).toBe('graphql-transport-ws');

        await expect(
          sendAndWaitForResponse(socket, { type: 'user:delete', data: { id: userId } }, 'user:delete:success'),
        ).resolves.toEqual(response);

        expect(deleteHandler.messages).toHaveLength(1);
      } finally {
        await closeWebSocketClient(socket);
      }
    });

    it('should support responding based on the subprotocols requested by sockets', async () => {
      const tokenProtocol = `token.${crypto.randomUUID()}`;
      const requestedProtocols = ['graphql-transport-ws', tokenProtocol];

      const deleteHandler = await userInterceptor
        .message()
        .with({ type: 'user:delete' })
        .respond((_message, { sender }) => ({
          type: 'user:delete:success',
          data: { id: sender.protocols.join(',') },
        }))
        .times(1);

      const socket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL, requestedProtocols);

      try {
        expect(socket.protocol).toBe('graphql-transport-ws');

        await waitFor(() => {
          expect(userInterceptor.clients).toHaveLength(userSockets.length + 1);
        });
        expect(userInterceptor.clients[userSockets.length].protocols).toEqual(requestedProtocols);

        const message: UserWebSocketMessage<'user:delete'> = {
          type: 'user:delete',
          data: { id: crypto.randomUUID() },
        };

        await expect(sendAndWaitForResponse(socket, message, 'user:delete:success')).resolves.toEqual({
          type: 'user:delete:success',
          data: { id: requestedProtocols.join(',') },
        });

        expect(deleteHandler.messages).toHaveLength(1);
      } finally {
        await closeWebSocketClient(socket);
      }
    });

    it('should expose no subprotocols for sockets that requested none', async () => {
      const socket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL);

      try {
        expect(socket.protocol).toBe('');

        await waitFor(() => {
          expect(userInterceptor.clients).toHaveLength(userSockets.length + 1);
        });
        expect(userInterceptor.clients[userSockets.length].protocols).toEqual([]);
      } finally {
        await closeWebSocketClient(socket);
      }
    });
  });

  describe('Connection URLs', () => {
    it('should support responding based on the path and search params of the connection URL', async () => {
      const roomURL = `${userInterceptor.baseURL}/rooms/1?token=${crypto.randomUUID()}`;

      const deleteHandler = await userInterceptor
        .message()
        .with({ type: 'user:delete' })
        .respond((_message, { sender }) => ({ type: 'user:delete:success', data: { id: sender.url } }))
        .times(1);

      const socket = await openSocket<UserWebSocketSchema>(roomURL);

      try {
        await waitFor(() => expect(userInterceptor.clients).toHaveLength(userSockets.length + 1));
        expect(userInterceptor.clients[userSockets.length].url).toBe(roomURL);

        const message: UserWebSocketMessage<'user:delete'> = { type: 'user:delete', data: { id: crypto.randomUUID() } };

        await expect(sendAndWaitForResponse(socket, message, 'user:delete:success')).resolves.toEqual({
          type: 'user:delete:success',
          data: { id: roomURL },
        });

        expect(deleteHandler.messages).toHaveLength(1);
      } finally {
        await closeWebSocketClient(socket);
      }
    });
  });

  describe('Connection closes', () => {
    it('should support reconnecting after the interceptor closes a connection', async () => {
      const sockets: ClientTestWebSocket<UserWebSocketSchema>[] = [];

      try {
        const closedSocket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL);
        sockets.push(closedSocket);

        await waitFor(() => expect(userInterceptor.clients).toHaveLength(userSockets.length + 1));
        const closedClient = userInterceptor.clients[userSockets.length];

        const closeEventPromise = new Promise<ClientTestWebSocketCloseEvent>((resolve) => {
          closedSocket.addEventListener('close', resolve);
        });

        closedClient.close(4000, 'Reconnect to continue.');

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(4000);
        expect(closeEvent.reason).toBe('Reconnect to continue.');

        await waitFor(() => expect(userInterceptor.clients).toHaveLength(userSockets.length));
        expect(userInterceptor.clients).not.toContain(closedClient);

        const reconnectedSocket = await openSocket<UserWebSocketSchema>(userInterceptor.baseURL);
        sockets.push(reconnectedSocket);

        await waitFor(() => expect(userInterceptor.clients).toHaveLength(userSockets.length + 1));
        const reconnectedClient = userInterceptor.clients[userSockets.length];

        const response: UserWebSocketMessage<'user:delete:success'> = {
          type: 'user:delete:success',
          data: { id: crypto.randomUUID() },
        };

        const deleteHandler = await userInterceptor
          .message()
          .from(reconnectedClient)
          .with({ type: 'user:delete' })
          .respond(response)
          .times(1);

        await expect(
          sendAndWaitForResponse(
            reconnectedSocket,
            { type: 'user:delete', data: { id: response.data.id } },
            'user:delete:success',
          ),
        ).resolves.toEqual(response);

        expect(deleteHandler.messages).toHaveLength(1);
        expect(deleteHandler.messages[0].sender).toBe(reconnectedClient);
      } finally {
        await Promise.all(sockets.map((socket) => closeWebSocketClient(socket)));
      }
    });
  });

  describe('Notifications', () => {
    const notification: Notification = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      content: 'Notification content',
      readAt: null,
    };

    const updatedNotification: Notification = {
      ...notification,
      content: 'Updated notification content',
    };

    const readNotification: Notification = {
      ...notification,
      readAt: new Date().toISOString(),
    };

    const unreadNotification: Notification = {
      ...readNotification,
      readAt: null,
    };

    function sendNotificationFromServer(message: NotificationWebSocketSchema) {
      const serializedMessage = JSON.stringify(message);

      notificationInterceptor.server.send(serializedMessage);
    }

    function expectNoSavedServerSentNotificationMessages() {
      expect(notificationInterceptor.server.messages).toHaveLength(0);

      for (const client of notificationInterceptor.clients) {
        expect(client.messages).toHaveLength(0);
      }
    }

    function waitForNotificationCreation(socket: ClientTestWebSocket<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:create:success');
    }

    function waitForNotificationUpdate(socket: ClientTestWebSocket<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:update:success');
    }

    it('should support receiving notification creation events started by the server', async () => {
      const message: NotificationWebSocketMessage<'notification:create:success'> = {
        type: 'notification:create:success',
        data: notification,
      };

      const responsesPromise = Promise.all(notificationSockets.map((socket) => waitForNotificationCreation(socket)));

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<NotificationWebSocketMessage<'notification:create:success'>>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });

    it('should support sending notification creation events to a selected client', async () => {
      const message: NotificationWebSocketMessage<'notification:create:success'> = {
        type: 'notification:create:success',
        data: notification,
      };

      const responsePromise = waitForNotificationCreation(notificationSockets[0]);
      const otherClientMessageListener = vi.fn();
      notificationSockets[1].addEventListener('message', otherClientMessageListener);

      try {
        notificationInterceptor.clients[0].send(JSON.stringify(message));

        expect(await responsePromise).toEqual(message);

        await waitForNot(() => {
          expect(otherClientMessageListener).toHaveBeenCalled();
        });

        expectNoSavedServerSentNotificationMessages();
      } finally {
        notificationSockets[1].removeEventListener('message', otherClientMessageListener);
      }
    });

    it.each<{
      target: string;
      selectRecipients: (
        clients: readonly WebSocketInterceptorClient<NotificationWebSocketSchema>[],
      ) =>
        | WebSocketInterceptorClient<NotificationWebSocketSchema>
        | readonly WebSocketInterceptorClient<NotificationWebSocketSchema>[];
      expectedThirdSocketMessageTypes: NotificationWebSocketSchema['type'][];
    }>([
      {
        target: 'single client',
        selectRecipients: (clients) => clients[0],
        expectedThirdSocketMessageTypes: ['notification:update:success'],
      },
      {
        target: 'client array',
        selectRecipients: (clients) => [clients[0], clients[2]] as const,
        expectedThirdSocketMessageTypes: ['notification:create:success', 'notification:update:success'],
      },
    ])(
      'should target server notifications to a $target and preserve broadcasts',
      async ({ selectRecipients, expectedThirdSocketMessageTypes }) => {
        const thirdSocket = await openSocket<NotificationWebSocketSchema>(notificationInterceptor.baseURL);
        const sockets = [...notificationSockets, thirdSocket];
        const messageListeners = sockets.map(() =>
          vi.fn<(event: ClientTestWebSocketMessageEvent<NotificationWebSocketSchema>) => void>(),
        );
        const message: NotificationWebSocketMessage<'notification:create:success'> = {
          type: 'notification:create:success',
          data: notification,
        };
        const broadcast: NotificationWebSocketMessage<'notification:update:success'> = {
          type: 'notification:update:success',
          data: updatedNotification,
        };

        try {
          await waitFor(() => expect(notificationInterceptor.clients).toHaveLength(sockets.length));

          for (const [index, socket] of sockets.entries()) {
            socket.addEventListener('message', messageListeners[index]);
          }

          const broadcastsPromise = Promise.all(sockets.map((socket) => waitForNotificationUpdate(socket)));
          const recipients = selectRecipients(notificationInterceptor.clients);

          notificationInterceptor.server.send(JSON.stringify(message), { to: recipients });
          notificationInterceptor.server.send(JSON.stringify(broadcast));

          expect(await broadcastsPromise).toEqual([broadcast, broadcast, broadcast]);
          expect(messageListeners[0].mock.calls.map(([event]) => JSON.parse(event.data))).toEqual([message, broadcast]);
          expect(messageListeners[1].mock.calls.map(([event]) => JSON.parse(event.data))).toEqual([broadcast]);
          expect(messageListeners[2].mock.calls.map(([event]) => JSON.parse(event.data).type)).toEqual(
            expectedThirdSocketMessageTypes,
          );

          expectNoSavedServerSentNotificationMessages();
        } finally {
          for (const [index, socket] of sockets.entries()) {
            socket.removeEventListener('message', messageListeners[index]);
          }
          await closeWebSocketClient(thirdSocket);
        }
      },
    );

    type ServerStartedNotificationMessage = NotificationWebSocketMessage<
      | 'notification:update:success'
      | 'notification:read:success'
      | 'notification:read:error'
      | 'notification:unread:success'
    >;

    it.each<ServerStartedNotificationMessage>([
      { type: 'notification:update:success', data: updatedNotification },
      { type: 'notification:read:success', data: readNotification },
      { type: 'notification:read:error', data: { code: 'validation_error', message: 'Invalid input' } },
      { type: 'notification:unread:success', data: unreadNotification },
    ])('should support receiving $type messages started by the server', async (message) => {
      const responsesPromise = Promise.all(
        notificationSockets.map((socket) => waitForResponseMessage(socket, message.type)),
      );

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<ServerStartedNotificationMessage>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });
  });

  describe('Binary messages', () => {
    const receivedBinaryTypes = [
      { binaryType: undefined, receivedMessageType: defaultBinaryMessageType },
      { binaryType: 'arraybuffer', receivedMessageType: ArrayBuffer },
    ] as const;

    const sentPayloads = [
      { payloadType: 'ArrayBuffer', createPayload: () => new Uint8Array([0x00, 0xff]).buffer },
      { payloadType: 'Uint8Array', createPayload: () => new Uint8Array([0x00, 0xff]) },
      { payloadType: 'Blob', createPayload: () => new Blob([new Uint8Array([0x00, 0xff])]) },
    ];

    it.each(
      receivedBinaryTypes.flatMap(({ binaryType, receivedMessageType }) =>
        sentPayloads.map((payload) => ({
          ...payload,
          binaryType,
          binaryTypeName: binaryType ?? 'client default',
          receivedMessageType,
        })),
      ),
    )(
      'should support responding to $payloadType binary messages received with the $binaryTypeName binary type',
      async ({ binaryType, receivedMessageType, createPayload }) => {
        binarySocket.binaryType = binaryType ?? binarySocket.binaryType;

        const binaryHandler = await binaryInterceptor
          .message()
          .with(new Uint8Array([0x00, 0xff]).buffer)
          .respond(new Uint8Array([0xff, 0x00]).buffer)
          .times(1);

        const responsePromise = waitForBinaryMessage(binarySocket);
        binarySocket.send(createPayload());

        const response = await responsePromise;
        expect(response).toBeInstanceOf(receivedMessageType);
        expect(await readBytes(response)).toEqual([0xff, 0x00]);

        expect(binaryHandler.messages).toHaveLength(1);
        expect(await readBytes(binaryHandler.messages[0].data)).toEqual([0x00, 0xff]);
        expect(binaryHandler.messages[0].sender).toBe(binaryInterceptor.clients[0]);
        expect(binaryHandler.messages[0].receiver).toBe(binaryInterceptor.server);
      },
    );
  });
}
