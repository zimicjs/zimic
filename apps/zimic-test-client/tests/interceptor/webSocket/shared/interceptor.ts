import { JSONSerialized } from '@zimic/http';
import {
  createWebSocketInterceptor,
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptor,
  WebSocketInterceptorClient,
  WebSocketInterceptorType,
} from '@zimic/interceptor/experimental/ws';
import { WebSocketClient } from '@zimic/ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

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

export function declareWebSocketInterceptorTests({ platform, type }: ClientTestOptionsByWorkerType) {
  const userInterceptor = createWebSocketInterceptor<UserWebSocketSchema>({
    type: 'remote', // TODO: Use the matrix type and fix type errors resulting from it.
    baseURL: getUserBaseURL(type),
    messageSaving: { enabled: true },
  });

  const notificationInterceptor = createWebSocketInterceptor<NotificationWebSocketSchema>({
    type: 'remote', // TODO: Use the matrix type and fix type errors resulting from it.
    baseURL: getNotificationBaseURL(type),
    messageSaving: { enabled: true },
  });

  const interceptors = [userInterceptor, notificationInterceptor];

  const userSockets = [
    new WebSocketClient<UserWebSocketSchema>(userInterceptor.baseURL),
    new WebSocketClient<UserWebSocketSchema>(userInterceptor.baseURL),
  ];

  const notificationSockets = [
    new WebSocketClient<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
    new WebSocketClient<NotificationWebSocketSchema>(notificationInterceptor.baseURL),
  ];

  const sockets = [...userSockets, ...notificationSockets];

  function expectMessagedClients<Schema extends UserWebSocketSchema | NotificationWebSocketSchema>(
    interceptor: WebSocketInterceptor<Schema>,
    message: Schema,
    notifiedClients: WebSocketInterceptorClient<Schema>[],
  ) {
    for (const client of interceptor.clients) {
      if (notifiedClients.includes(client)) {
        expect(client.messages).toHaveLength(1);
        expect(client.messages[0]).toEqual<InterceptedWebSocketInterceptorMessage<Schema>>({
          data: message,
          sender: interceptor.server,
          receiver: client,
        });
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

    await Promise.all(sockets.map((socket) => socket.open()));

    expect(userInterceptor.clients).toHaveLength(userSockets.length);
    expect(notificationInterceptor.clients).toHaveLength(notificationSockets.length);
  });

  beforeEach(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.clear();
      }),
    );
  });

  afterEach(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.checkTimes();
      }),
    );
  });

  afterAll(async () => {
    await Promise.all(sockets.map((socket) => socket.close()));

    expect(userInterceptor.clients).toHaveLength(0);
    expect(notificationInterceptor.clients).toHaveLength(0);

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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(creationHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        const response = await createUser(creationInput);
        expectTypeOf(response).toEqualTypeOf<UserWebSocketMessage<'user:create:success'>>();

        expect(response.data).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationInput.name,
          email: creationInput.email,
          birthDate: creationInput.birthDate,
        });

        expectMessagedClients(userInterceptor, response, userInterceptor.clients);
        expect(creationHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(creationHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(creationHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(updateHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(updateHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(updateHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(deleteHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
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

        expectMessagedClients(userInterceptor, response, [creatorClient]);
        expect(deleteHandler.messages).toEqual(
          expect.arrayContaining(userInterceptor.clients.flatMap((client) => client.messages)),
        );
      });
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

    async function createNotification(socket: WebSocketClient<NotificationWebSocketSchema>) {
      const responsePromise = waitForResponseMessage(socket, 'notification:create:success');

      const message: NotificationWebSocketMessage<'notification:create:success'> = {
        type: 'notification:create:success',
        data: notification,
      };

      socket.send(JSON.stringify(message));

      return responsePromise;
    }

    async function updateNotification(socket: WebSocketClient<NotificationWebSocketSchema>) {
      const responsePromise = waitForResponseMessage(socket, 'notification:update:success');

      const message: NotificationWebSocketMessage<'notification:update:success'> = {
        type: 'notification:update:success',
        data: updatedNotification,
      };

      socket.send(JSON.stringify(message));

      return responsePromise;
    }

    async function markNotificationAsRead(socket: WebSocketClient<NotificationWebSocketSchema>) {
      const responsePromise = waitForResponseMessage(socket, 'notification:read:success');
      const message: NotificationWebSocketMessage<'notification:read:success'> = {
        type: 'notification:read:success',
        data: readNotification,
      };

      socket.send(JSON.stringify(message));

      return responsePromise;
    }

    async function failToMarkNotificationAsRead(socket: WebSocketClient<NotificationWebSocketSchema>) {
      const responsePromise = waitForResponseMessage(socket, 'notification:read:error');
      const validationError: ValidationError = {
        code: 'validation_error',
        message: 'Invalid input',
      };
      const message: NotificationWebSocketMessage<'notification:read:error'> = {
        type: 'notification:read:error',
        data: validationError,
      };

      socket.send(JSON.stringify(message));

      return responsePromise;
    }

    async function markNotificationAsUnread(socket: WebSocketClient<NotificationWebSocketSchema>) {
      const responsePromise = waitForResponseMessage(socket, 'notification:unread:success');
      const message: NotificationWebSocketMessage<'notification:unread:success'> = {
        type: 'notification:unread:success',
        data: unreadNotification,
      };

      socket.send(JSON.stringify(message));

      return responsePromise;
    }

    it('should support creating notifications notifying all users', async () => {
      const creatorClient = notificationInterceptor.clients[0];

      const creationHandler = await notificationInterceptor
        .message()
        .from(creatorClient)
        .with({ type: 'notification:create:success', data: notification })
        .effect((message, { receiver }) => {
          receiver.send(JSON.stringify(message));
        })
        .times(1);

      const response = await createNotification(notificationSockets[0]);

      expectTypeOf(response).toEqualTypeOf<NotificationWebSocketMessage<'notification:create:success'>>();
      expect(response).toEqual({ type: 'notification:create:success', data: notification });

      expectMessagedClients(notificationInterceptor, response, notificationInterceptor.clients);
      expect(creationHandler.messages).toEqual(
        expect.arrayContaining(notificationInterceptor.clients.flatMap((client) => client.messages)),
      );
    });

    it('should support updating notifications notifying only the sender', async () => {
      const creatorClient = notificationInterceptor.clients[1];

      const updateHandler = await notificationInterceptor
        .message()
        .from(creatorClient)
        .with({ type: 'notification:update:success', data: updatedNotification })
        .respond({ type: 'notification:update:success', data: updatedNotification })
        .times(1);

      const response = await updateNotification(notificationSockets[1]);

      expectTypeOf(response).toEqualTypeOf<NotificationWebSocketMessage<'notification:update:success'>>();
      expect(response).toEqual({ type: 'notification:update:success', data: updatedNotification });

      expectMessagedClients(notificationInterceptor, response, [creatorClient]);
      expect(updateHandler.messages).toEqual(
        expect.arrayContaining(notificationInterceptor.clients.flatMap((client) => client.messages)),
      );
    });

    it('should support marking notifications as read', async () => {
      const creatorClient = notificationInterceptor.clients[0];

      const readHandler = await notificationInterceptor
        .message()
        .from(creatorClient)
        .with({ type: 'notification:read:success', data: readNotification })
        .respond({ type: 'notification:read:success', data: readNotification })
        .times(1);

      const response = await markNotificationAsRead(notificationSockets[0]);

      expectTypeOf(response).toEqualTypeOf<NotificationWebSocketMessage<'notification:read:success'>>();
      expect(response).toEqual({ type: 'notification:read:success', data: readNotification });

      expectMessagedClients(notificationInterceptor, response, [creatorClient]);
      expect(readHandler.messages).toEqual(
        expect.arrayContaining(notificationInterceptor.clients.flatMap((client) => client.messages)),
      );
    });

    it('should return an error if marking a notification as read fails', async () => {
      const creatorClient = notificationInterceptor.clients[0];
      const validationError: ValidationError = {
        code: 'validation_error',
        message: 'Invalid input',
      };

      const readHandler = await notificationInterceptor
        .message()
        .from(creatorClient)
        .with({ type: 'notification:read:error', data: validationError })
        .respond({ type: 'notification:read:error', data: validationError })
        .times(1);

      const response = await failToMarkNotificationAsRead(notificationSockets[0]);

      expectTypeOf(response).toEqualTypeOf<NotificationWebSocketMessage<'notification:read:error'>>();
      expect(response).toEqual({ type: 'notification:read:error', data: validationError });

      expectMessagedClients(notificationInterceptor, response, [creatorClient]);
      expect(readHandler.messages).toEqual(
        expect.arrayContaining(notificationInterceptor.clients.flatMap((client) => client.messages)),
      );
    });

    it('should support marking notifications as unread', async () => {
      const creatorClient = notificationInterceptor.clients[1];

      const unreadHandler = await notificationInterceptor
        .message()
        .from(creatorClient)
        .with({ type: 'notification:unread:success', data: unreadNotification })
        .respond({ type: 'notification:unread:success', data: unreadNotification })
        .times(1);

      const response = await markNotificationAsUnread(notificationSockets[1]);

      expectTypeOf(response).toEqualTypeOf<NotificationWebSocketMessage<'notification:unread:success'>>();
      expect(response).toEqual({ type: 'notification:unread:success', data: unreadNotification });

      expectMessagedClients(notificationInterceptor, response, [creatorClient]);
      expect(unreadHandler.messages).toEqual(
        expect.arrayContaining(notificationInterceptor.clients.flatMap((client) => client.messages)),
      );
    });
  });
}
