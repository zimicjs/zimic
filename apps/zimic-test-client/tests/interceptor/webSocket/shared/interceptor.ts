import { JSONSerialized } from '@zimic/http';
import {
  createWebSocketInterceptor,
  InterceptedWebSocketInterceptorMessage,
  InferWebSocketInterceptorSchema,
  LocalWebSocketInterceptor,
  LocalWebSocketMessageHandler,
  RemoteWebSocketInterceptor,
  RemoteWebSocketMessageHandler,
  WebSocketInterceptor,
  WebSocketInterceptorClient,
  WebSocketMessageHandlerComputedRestriction,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerStaticRestriction,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
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

import { ClientTestOptionsByWorkerType } from './client';

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
>(socket: WebSocketClient<Schema>, responseMessageType: ResponseMessageType) {
  return new Promise<Extract<Schema, { type: ResponseMessageType }>>((resolve, reject) => {
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === responseMessageType) {
          resolve(message);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function waitForBinaryMessage(socket: WebSocketClient<BinaryWebSocketSchema>) {
  return new Promise<Blob | BufferSource>((resolve) => {
    socket.addEventListener('message', (event) => {
      resolve(event.data);
    });
  });
}

async function readBytes(data: Blob | BufferSource) {
  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const uint8Array =
    arrayBuffer instanceof ArrayBuffer ? new Uint8Array(arrayBuffer) : new Uint8Array(arrayBuffer.buffer);

  return Array.from(uint8Array);
}

export function declareWebSocketInterceptorTests({ platform, type }: ClientTestOptionsByWorkerType) {
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

  const userSockets = [
    new WebSocketClient<UserWebSocketSchema>(userInterceptor.baseURL),
    new WebSocketClient<UserWebSocketSchema>(userInterceptor.baseURL),
  ];

  const notificationSockets = [
    new WebSocketClient<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
    new WebSocketClient<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
  ];

  const binarySocket = new WebSocketClient<BinaryWebSocketSchema>(binaryInterceptor.baseURL);
  binarySocket.binaryType = 'arraybuffer';

  const sockets = [...userSockets, ...notificationSockets, binarySocket];

  function isNoUserMessage(message: UserWebSocketSchema): message is never {
    void message;
    return false;
  }

  function isNoNotificationMessage(message: NotificationWebSocketSchema): message is never {
    void message;
    return false;
  }

  function isNoBinaryMessage(message: BinaryWebSocketSchema): message is never {
    void message;
    return false;
  }

  function expectMessagedClients<Schema extends UserWebSocketSchema | NotificationWebSocketSchema>(
    interceptor: WebSocketInterceptor<Schema>,
    message: Schema,
    notifiedClients: WebSocketInterceptorClient<Schema>[],
    expectedClientMessage: Schema = message,
  ) {
    for (const client of interceptor.clients) {
      if (notifiedClients.includes(client)) {
        expect(client.messages).toHaveLength(1);

        if (client.messages[0].sender === interceptor.server) {
          expect(client.messages[0]).toEqual<InterceptedWebSocketInterceptorMessage<Schema>>({
            data: message,
            sender: interceptor.server,
            receiver: client,
          });
        } else {
          expect(client.messages[0].data).toEqual(expectedClientMessage);
          expect(client.messages[0].sender).toBe(client);
          expect(client.messages[0].receiver).toBe(interceptor.server);
        }
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

    await Promise.resolve(userInterceptor.message().with(isNoUserMessage));
    await Promise.resolve(notificationInterceptor.message().with(isNoNotificationMessage));
    await Promise.resolve(binaryInterceptor.message().with(isNoBinaryMessage));

    for (const socket of sockets) {
      await socket.open();
    }

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
      await Promise.all(sockets.map((socket) => socket.close()));

      await waitFor(() => {
        expect(userInterceptor.clients).toHaveLength(0);
        expect(notificationInterceptor.clients).toHaveLength(0);
        expect(binaryInterceptor.clients).toHaveLength(0);
      });
    }
  });

  afterAll(async () => {
    expect(userInterceptor.clients).toHaveLength(0);
    expect(notificationInterceptor.clients).toHaveLength(0);
    expect(binaryInterceptor.clients).toHaveLength(0);

    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
      }),
    );
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

      async function createUser(input: UserCreationInput) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:create:success');

        const message: UserWebSocketMessage<'user:create'> = {
          type: 'user:create',
          data: input,
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

      async function createUserError(input: UserCreationInput) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:create:error');

        const message: UserWebSocketMessage<'user:create'> = {
          type: 'user:create',
          data: input,
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

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

        const response = await createUser(creationInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:success'>>();

        expect(response.data).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationInput.name,
          email: creationInput.email,
          birthDate: creationInput.birthDate,
        });

        expectMessagedClients(userInterceptor, response, [creatorClient], { type: 'user:create', data: creationInput });
        expect(creationHandler.messages).toHaveLength(1);
      });

      it('should support creating users notifying all users', async () => {
        const creatorClient = userInterceptor.clients[0];

        const creationHandler = await userInterceptor
          .message()
          .from(creatorClient)
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

      it('should return an error if the input is not valid', async () => {
        // @ts-expect-error Forcing an invalid input
        const invalidInput: UserCreationInput = {};
        const creatorClient = userInterceptor.clients[0];

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid input',
        };

        const creationHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({ type: 'user:create', data: invalidInput })
          .respond({ type: 'user:create:error', data: validationError })
          .times(1);

        const response = await createUserError(invalidInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:error'>>();

        expect(response).toEqual({ type: 'user:create:error', data: validationError });

        expectMessagedClients(userInterceptor, response, [creatorClient], { type: 'user:create', data: invalidInput });
        expect(creationHandler.messages).toHaveLength(1);
      });

      it('should return an error if the user already exists', async () => {
        const creatorClient = userInterceptor.clients[0];
        const conflictError: ConflictError = {
          code: 'conflict',
          message: 'User already exists',
        };

        const creationHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({ type: 'user:create', data: creationInput })
          .respond({ type: 'user:create:error', data: conflictError })
          .times(1);

        const response = await createUserError(creationInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:error'>>();

        expect(response).toEqual({ type: 'user:create:error', data: conflictError });

        expectMessagedClients(userInterceptor, response, [creatorClient], { type: 'user:create', data: creationInput });
        expect(creationHandler.messages).toHaveLength(1);
      });
    });

    describe('User update', () => {
      const updateInput: UserUpdateInput = {
        name: 'Updated Name',
        email: 'updated@email.com',
        birthDate: new Date().toISOString(),
      };

      async function updateUser(userId: string, input: UserUpdateInput) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:update:success');

        const message: UserWebSocketMessage<'user:update'> = {
          type: 'user:update',
          data: { id: userId, ...input },
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

      async function updateUserError(userId: string, input: UserUpdateInput) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:update:error');

        const message: UserWebSocketMessage<'user:update'> = {
          type: 'user:update',
          data: { id: userId, ...input },
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

      it('should support updating users', async () => {
        const creatorClient = userInterceptor.clients[0];

        const updateHandler = await userInterceptor
          .message()
          .from(creatorClient)
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

        const response = await updateUser(user.id, updateInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:success'>>();

        expect(response.data).toEqual<JSONSerialized<User>>({
          ...serializeUser(user),
          ...updateInput,
        });

        expectMessagedClients(userInterceptor, response, [creatorClient], {
          type: 'user:update',
          data: { id: user.id, ...updateInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });

      it('should return an error if user not found', async () => {
        const creatorClient = userInterceptor.clients[0];

        const unknownUserId = crypto.randomUUID();

        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const updateHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({
            type: 'user:update',
            data: { id: unknownUserId, ...updateInput },
          })
          .respond({ type: 'user:update:error', data: notFoundError })
          .times(1);

        const response = await updateUserError(unknownUserId, updateInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:error'>>();

        expect(response).toEqual({ type: 'user:update:error', data: notFoundError });

        expectMessagedClients(userInterceptor, response, [creatorClient], {
          type: 'user:update',
          data: { id: unknownUserId, ...updateInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });

      it('should return an error if input is invalid', async () => {
        const creatorClient = userInterceptor.clients[0];

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
          .from(creatorClient)
          .with({
            type: 'user:update',
            data: { id: user.id, ...invalidInput },
          })
          .respond({ type: 'user:update:error', data: validationError })
          .times(1);

        const response = await updateUserError(user.id, invalidInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:update:error'>>();

        expect(response).toEqual({ type: 'user:update:error', data: validationError });

        expectMessagedClients(userInterceptor, response, [creatorClient], {
          type: 'user:update',
          data: { id: user.id, ...invalidInput },
        });
        expect(updateHandler.messages).toHaveLength(1);
      });
    });

    describe('User deletion', () => {
      async function deleteUserById(userId: string) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:delete:success');

        const message: UserWebSocketMessage<'user:delete'> = {
          type: 'user:delete',
          data: { id: userId },
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

      async function deleteUserByIdError(userId: string) {
        const responsePromise = waitForResponseMessage(userSockets[0], 'user:delete:error');

        const message: UserWebSocketMessage<'user:delete'> = {
          type: 'user:delete',
          data: { id: userId },
        };

        userSockets[0].send(JSON.stringify(message));

        return responsePromise;
      }

      it('should support deleting users by id', async () => {
        const creatorClient = userInterceptor.clients[0];

        const deleteHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({
            type: 'user:delete',
            data: { id: user.id },
          })
          .respond({
            type: 'user:delete:success',
            data: { id: user.id },
          })
          .times(1);

        const response = await deleteUserById(user.id);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:delete:success'>>();

        expect(response).toEqual({
          type: 'user:delete:success',
          data: { id: user.id },
        });

        expectMessagedClients(userInterceptor, response, [creatorClient], {
          type: 'user:delete',
          data: { id: user.id },
        });
        expect(deleteHandler.messages).toHaveLength(1);
      });

      it('should return an error if the user was not found', async () => {
        const creatorClient = userInterceptor.clients[0];

        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const deleteHandler = await userInterceptor
          .message()
          .from(creatorClient)
          .with({
            type: 'user:delete',
            data: { id: user.id },
          })
          .respond({ type: 'user:delete:error', data: notFoundError })
          .times(1);

        const response = await deleteUserByIdError(user.id);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:delete:error'>>();

        expect(response).toEqual({ type: 'user:delete:error', data: notFoundError });

        expectMessagedClients(userInterceptor, response, [creatorClient], {
          type: 'user:delete',
          data: { id: user.id },
        });
        expect(deleteHandler.messages).toHaveLength(1);
      });
    });
  });

  describe('Types', () => {
    it('should expose installed WebSocket interceptor types to consumers', () => {
      const localInterceptor = createWebSocketInterceptor<UserWebSocketSchema>({
        type: 'local',
        baseURL: getUserBaseURL('local'),
      });
      const remoteInterceptor = createWebSocketInterceptor<UserWebSocketSchema>({
        type: 'remote',
        baseURL: getUserBaseURL('remote'),
      });

      expectTypeOf(localInterceptor).toEqualTypeOf<LocalWebSocketInterceptor<UserWebSocketSchema>>();
      expectTypeOf(remoteInterceptor).toEqualTypeOf<RemoteWebSocketInterceptor<UserWebSocketSchema>>();
      expectTypeOf(localInterceptor.message).returns.toEqualTypeOf<LocalWebSocketMessageHandler<UserWebSocketSchema>>();
      expectTypeOf(remoteInterceptor.message).returns.toEqualTypeOf<
        RemoteWebSocketMessageHandler<UserWebSocketSchema>
      >();

      expectTypeOf<InferWebSocketInterceptorSchema<typeof localInterceptor>>().toEqualTypeOf<UserWebSocketSchema>();
      expectTypeOf<InferWebSocketInterceptorSchema<typeof remoteInterceptor>>().toEqualTypeOf<UserWebSocketSchema>();

      expectTypeOf<WebSocketMessageHandlerStaticRestriction<UserWebSocketSchema>>().not.toBeAny();
      expectTypeOf<WebSocketMessageHandlerComputedRestriction<UserWebSocketSchema>>().parameters.toEqualTypeOf<
        [message: UserWebSocketSchema]
      >();
      expectTypeOf<WebSocketMessageHandlerMessageCallback<UserWebSocketSchema>>().parameters.toEqualTypeOf<
        [
          message: UserWebSocketSchema,
          context: {
            sender: WebSocketInterceptorClient<UserWebSocketSchema>;
            receiver: WebSocketInterceptorClient<UserWebSocketSchema>;
          },
        ]
      >();
    });

    it('should narrow handler messages from installed schema restrictions', async () => {
      const creatorClient = userInterceptor.clients[0];

      const creationHandler = await userInterceptor.message().from(creatorClient).with({ type: 'user:create' });

      expectTypeOf(creationHandler.messages).toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<UserWebSocketMessage<'user:create'>, UserWebSocketSchema>[]
      >();

      creationHandler.respond((message, context) => {
        expectTypeOf(message).toEqualTypeOf<UserWebSocketMessage<'user:create'>>();
        expectTypeOf(context.sender).toEqualTypeOf<WebSocketInterceptorClient<UserWebSocketSchema>>();
        expectTypeOf(context.receiver).toEqualTypeOf<WebSocketInterceptorClient<UserWebSocketSchema>>();

        return {
          type: 'user:create:error',
          data: { code: 'validation_error', message: message.data.name },
        };
      });
    });

    it('should reject invalid installed WebSocket declarations', () => {
      function expectInvalidDeclarations(interceptor: LocalWebSocketInterceptor<UserWebSocketSchema>) {
        // @ts-expect-error Invalid message type.
        interceptor.message().with({ type: 'user:archive' });

        // @ts-expect-error Invalid response type.
        interceptor.message().respond({ type: 'user:archive:success' });

        // @ts-expect-error Invalid response data shape.
        interceptor.message().respond({ type: 'user:create:success', data: { id: crypto.randomUUID() } });
      }

      void expectInvalidDeclarations;
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

    function waitForNotificationCreation(socket: WebSocketClient<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:create:success');
    }

    function waitForNotificationUpdate(socket: WebSocketClient<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:update:success');
    }

    function waitForNotificationRead(socket: WebSocketClient<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:read:success');
    }

    function waitForNotificationReadError(socket: WebSocketClient<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:read:error');
    }

    function waitForNotificationUnread(socket: WebSocketClient<NotificationWebSocketSchema>) {
      return waitForResponseMessage(socket, 'notification:unread:success');
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

    it('should support receiving notification update events started by the server', async () => {
      const message: NotificationWebSocketMessage<'notification:update:success'> = {
        type: 'notification:update:success',
        data: updatedNotification,
      };

      const responsesPromise = Promise.all(notificationSockets.map((socket) => waitForNotificationUpdate(socket)));

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<NotificationWebSocketMessage<'notification:update:success'>>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });

    it('should support receiving notification read events started by the server', async () => {
      const message: NotificationWebSocketMessage<'notification:read:success'> = {
        type: 'notification:read:success',
        data: readNotification,
      };

      const responsesPromise = Promise.all(notificationSockets.map((socket) => waitForNotificationRead(socket)));

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<NotificationWebSocketMessage<'notification:read:success'>>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });

    it('should support receiving notification read errors started by the server', async () => {
      const validationError: ValidationError = {
        code: 'validation_error',
        message: 'Invalid input',
      };
      const message: NotificationWebSocketMessage<'notification:read:error'> = {
        type: 'notification:read:error',
        data: validationError,
      };

      const responsesPromise = Promise.all(notificationSockets.map((socket) => waitForNotificationReadError(socket)));

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<NotificationWebSocketMessage<'notification:read:error'>>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });

    it('should support receiving notification unread events started by the server', async () => {
      const message: NotificationWebSocketMessage<'notification:unread:success'> = {
        type: 'notification:unread:success',
        data: unreadNotification,
      };

      const responsesPromise = Promise.all(notificationSockets.map((socket) => waitForNotificationUnread(socket)));

      sendNotificationFromServer(message);

      const responses = await responsesPromise;

      expectTypeOf(responses[0]).toEqualTypeOf<NotificationWebSocketMessage<'notification:unread:success'>>();
      expect(responses).toEqual([message, message]);

      expectNoSavedServerSentNotificationMessages();
    });
  });

  describe('Binary messages', () => {
    it('should support responding to binary messages', async () => {
      const message = new Uint8Array([0x00, 0xff]).buffer;
      const binaryClient = binaryInterceptor.clients[0];

      const binaryHandler = await binaryInterceptor
        .message()
        .from(binaryClient)
        .with(message)
        .respond(message)
        .times(1);

      const responsePromise = waitForBinaryMessage(binarySocket);

      binarySocket.send(message);

      const response = await responsePromise;

      expect(await readBytes(response)).toEqual([0x00, 0xff]);
      expect(binaryHandler.messages).toHaveLength(1);
      expect(await readBytes(binaryHandler.messages[0].data)).toEqual([0x00, 0xff]);
      expect(binaryHandler.messages[0].sender).toBe(binaryClient);
      expect(binaryHandler.messages[0].receiver).toBe(binaryInterceptor.server);
    });
  });
}
