/*

TODO: This file is partially commented while the WebSocket interceptor is still being implemented.

import { JSONSerialized } from '@zimic/http';
import { createWebSocketInterceptor, WebSocketInterceptorType } from '@zimic/interceptor/ws';
import { WebSocketClient } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf, afterEach } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import {
  AuthWebSocketSchema,
  ConflictError,
  NotFoundError,
  NotificationWebSocketSchema,
  User,
  UserCreationRequestBody,
  UserListSearchParams,
  UserUpdatePayload,
  ValidationError,
} from '@tests/types/schema';
import { importCrypto, IsomorphicCrypto } from '@tests/utils/crypto';
import { serializeUser } from '@tests/utils/schema';

function getAuthBaseURL(type: WebSocketInterceptorType, crypto: IsomorphicCrypto) {
  return type === 'local' ? 'ws://localhost:4000' : `ws://localhost:${ZIMIC_SERVER_PORT}/auth-${crypto.randomUUID()}`;
}

function getNotificationBaseURL(type: WebSocketInterceptorType, crypto: IsomorphicCrypto) {
  return type === 'local'
    ? 'ws://localhost:4001'
    : `ws://localhost:${ZIMIC_SERVER_PORT}/notification-${crypto.randomUUID()}`;
}
*/

import { ClientTestOptionsByWorkerType } from './client';

export async function declareWebSocketInterceptorTests(_options: ClientTestOptionsByWorkerType) {
  /*
  const { platform, type } = _options;

  const crypto = await importCrypto();

  const authInterceptor = createWebSocketInterceptor<AuthWebSocketSchema>({
    type,
    baseURL: getAuthBaseURL(type, crypto),
    messageSaving: { enabled: true },
  });

  const notificationInterceptor = createWebSocketInterceptor<NotificationWebSocketSchema>({
    type,
    baseURL: getNotificationBaseURL(type, crypto),
    messageSaving: { enabled: true },
  });

  const interceptors = [authInterceptor, notificationInterceptor];

  const authBaseURL = authInterceptor.baseURL;
  const authSocket = new WebSocketClient<AuthWebSocketSchema>(authBaseURL);

  const notificationBaseURL = notificationInterceptor.baseURL;
  const notificationSocket = new WebSocketClient<NotificationWebSocketSchema>(notificationBaseURL);

  beforeAll(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.start();
        expect(interceptor.isRunning).toBe(true);
        expect(interceptor.platform).toBe(platform);
      }),
    );

    await Promise.all([authSocket.open(), notificationSocket.open()]);

    expect(authInterceptor.clients).toHaveLength(1);
    expect(notificationInterceptor.clients).toHaveLength(1);
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
    await Promise.all([authSocket.close(), notificationSocket.close()]);

    expect(authInterceptor.clients).toHaveLength(0);
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
      const creationPayload: UserCreationRequestBody = {
        name: user.name,
        email: user.email,
        password: crypto.randomUUID(),
        birthDate: new Date().toISOString(),
      };

      function createUser(payload: UserCreationRequestBody) {
        authSocket.send(
          JSON.stringify({
            type: 'user:create',
            data: payload,
          }),
        );
      }

      it('should support creating users', async () => {
        const creationHandler = await authInterceptor
          .message()
          .from(authInterceptor.clients[0])
          .with({
            type: 'user:create',
            data: creationPayload,
          })
          .run((message, { sender }) => {
            if (message.type !== 'user:create') {
              return;
            }

            const user: JSONSerialized<User> = {
              id: crypto.randomUUID(),
              name: message.data.name,
              email: message.data.email,
              birthDate: message.data.birthDate,
            };

            sender.send(
              JSON.stringify({
                type: 'user:created',
                data: user,
              }),
            );
          })
          .times(1);

        const response = await createUser(creationPayload);
        expect(response.status).toBe(201);

        const createdUser = (await response.json()) as User;
        expect(createdUser).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationPayload.name,
          email: creationPayload.email,
          birthDate: creationPayload.birthDate,
        });

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          WebSocketHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expect(response.headers.get('x-user-id')).toBe(createdUser.id);
        expect(creationHandler.requests[0].response.headers.get('x-user-id')).toBe(createdUser.id);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          WebSocketRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(creationHandler.requests[0].response.body).toEqual(createdUser);

        expectTypeOf(creationHandler.requests[0].response.raw).branded.toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>, { 'x-user-id': User['id']; 'content-type': 'application/json' }, 201>
        >();
        expect(creationHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationHandler.requests[0].response.raw.json).toEqualTypeOf<
          () => Promise<JSONSerialized<User>>
        >();
        expect(await creationHandler.requests[0].response.raw.json()).toEqual(createdUser);
      });

      it('should return an error if the payload is not valid', async () => {
        // @ts-expect-error Forcing an invalid payload
        const invalidPayload: UserCreationRequestBody = {};

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid payload',
        };

        const creationHandler = await authInterceptor
          .post('/users')
          .with({ body: invalidPayload })
          .respond({ status: 400, body: validationError })
          .times(1);

        const response = await createUser(invalidPayload);
        expect(response.status).toBe(400);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          WebSocketHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          WebSocketRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ValidationError>();
        expect(creationHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<ValidationError, { 'content-type': 'application/json' }, 400>
        >();
        expect(creationHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<ValidationError>>();
        expect(await creationHandler.requests[0].response.raw.json()).toEqual(validationError);
      });

      it('should return an error if the payload is not valid', async () => {
        const conflictingPayload: UserCreationRequestBody = creationPayload;

        const conflictError: ConflictError = {
          code: 'conflict',
          message: 'User already exists',
        };
        const creationHandler = await authInterceptor
          .post('/users')
          .with({ body: conflictingPayload })
          .respond({ status: 409, body: conflictError })
          .times(1);

        const response = await createUser(conflictingPayload);
        expect(response.status).toBe(409);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          WebSocketHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(conflictingPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          WebSocketRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ConflictError>();
        expect(creationHandler.requests[0].response.body).toEqual(conflictError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<ConflictError, { 'content-type': 'application/json' }, 409>
        >();
        expect(creationHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<ConflictError>>();
        expect(await creationHandler.requests[0].response.raw.json()).toEqual(conflictError);
      });
    });

    describe('User list', () => {
      const users: User[] = [
        {
          id: crypto.randomUUID(),
          name: 'Name 1',
          email: 'email1@email.com',
          birthDate: new Date(),
        },
        {
          id: crypto.randomUUID(),
          name: 'Name 2',
          email: 'email2@email.com',
          birthDate: new Date(),
        },
        {
          id: crypto.randomUUID(),
          name: 'Name3',
          email: 'email3@email.com',
          birthDate: new Date(),
        },
      ];

      beforeEach(async () => {
        await authInterceptor.get('/users').respond({
          status: 200,
          body: [],
        });
      });

      async function listUsers(filters: UserListSearchParams = {}) {
        const searchParams = new WebSocketSearchParams<UserListSearchParams>(filters);
        const request = new Request(`${authBaseURL}/users?${searchParams.toString()}`, {
          method: 'GET',
        });
        return fetch(request);
      }

      it('should list users', async () => {
        const listHandler = await authInterceptor
          .get('/users')
          .respond({ status: 200, body: users.map(serializeUser) })
          .times(1);

        const response = await listUsers();
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(users.map(serializeUser));

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(users.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual(users.map(serializeUser));
      });

      it('should list users filtered by name', async () => {
        const user = users[0];

        const listHandler = await authInterceptor
          .get('/users')
          .with({ searchParams: { name: user.name } })
          .respond({ status: 200, body: [serializeUser(user)] })
          .times(1);

        const response = await listUsers({ name: user.name });
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual([serializeUser(user)]);

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(user.name);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual([serializeUser(user)]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual([serializeUser(user)]);
      });

      it('should list users with ordering', async () => {
        const usersSortedByDescendingEmail = [...users].sort((user, otherUser) => {
          return otherUser.email.localeCompare(user.email);
        });

        const listHandler = await authInterceptor
          .get('/users')
          .with({ searchParams: { orderBy: ['email.desc'] } })
          .respond({ status: 200, body: usersSortedByDescendingEmail.map(serializeUser) })
          .times(1);

        const response = await listUsers({
          orderBy: ['email.desc'],
        });
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(usersSortedByDescendingEmail.map(serializeUser));

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual(['email.desc']);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(usersSortedByDescendingEmail.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual(
          usersSortedByDescendingEmail.map(serializeUser),
        );
      });
    });

    describe('User get by id', () => {
      async function getUserById(userId: string) {
        const request = new Request(`${authBaseURL}/users/${userId}`, { method: 'GET' });
        return fetch(request);
      }

      it('should support getting users by id', async () => {
        const getHandler = await authInterceptor
          .get(`/users/${user.id}`)
          .respond({ status: 200, body: serializeUser(user) })
          .times(1);

        const response = await getUserById(user.id);
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(serializeUser(user));

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(getHandler.requests[0].response.body).toEqual(serializeUser(user));

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>, { 'content-type': 'application/json' }, 200>
        >();
        expect(getHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>>>();
        expect(await getHandler.requests[0].response.raw.json()).toEqual(serializeUser(user));
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const getHandler = await authInterceptor
          .get('/users/:userId')
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await getUserById(user.id);
        expect(response.status).toBe(404);

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(getHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(getHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
        >();
        expect(getHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<NotFoundError>>();
        expect(await getHandler.requests[0].response.raw.json()).toEqual(notFoundError);
      });
    });

    describe('User update', () => {
      const updatePayload: UserUpdatePayload = {
        name: 'Updated Name',
        email: 'updated@email.com',
        birthDate: new Date().toISOString(),
      };

      async function updateUser(userId: string, payload: UserUpdatePayload) {
        const request = new Request(`${authBaseURL}/users/${userId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return fetch(request);
      }

      it('should support updating users', async () => {
        const updateHandler = await authInterceptor
          .patch(`/users/${user.id}`)
          .with({
            headers: { 'content-type': 'application/json' },
            body: updatePayload,
          })
          .respond((request) => {
            const updatedUser: JSONSerialized<User> = {
              ...serializeUser(user),
              ...request.body,
            };

            return {
              status: 200,
              body: updatedUser,
            };
          })
          .times(1);

        const response = await updateUser(user.id, updatePayload);
        expect(response.status).toBe(200);

        const updatedUser = (await response.json()) as JSONSerialized<User>;
        expect(updatedUser).toEqual<JSONSerialized<User>>({
          ...serializeUser(user),
          ...updatePayload,
        });

        expect(updateHandler.requests).toHaveLength(1);

        expectTypeOf(updateHandler.requests[0].headers).branded.toEqualTypeOf<
          WebSocketHeaders<{ 'content-type': string }>
        >();

        expectTypeOf(updateHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(updateHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(updateHandler.requests[0].body).toEqualTypeOf<UserUpdatePayload>();
        expect(updateHandler.requests[0].body).toEqual(updatePayload);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<JSONSerialized<User>, { 'content-type': 'application/json' }, 200>
        >();
      });

      it('should return an error if user not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const updateHandler = await authInterceptor
          .patch('/users/:userId')
          .with({ body: updatePayload })
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await updateUser(crypto.randomUUID(), updatePayload);
        expect(response.status).toBe(404);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
        >();
      });

      it('should return an error if payload is invalid', async () => {
        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid payload',
        };

        const invalidPayload: UserUpdatePayload = {
          // @ts-expect-error Forcing an invalid payload
          invalid: 'invalid',
        };

        const updateHandler = await authInterceptor
          .patch('/users/:userId')
          .with({ body: invalidPayload })
          .respond({ status: 400, body: validationError })
          .times(1);

        const response = await updateUser(user.id, invalidPayload);
        expect(response.status).toBe(400);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<ValidationError, { 'content-type': 'application/json' }, 400>
        >();
      });
    });

    describe('User deletion', () => {
      async function deleteUserById(userId: string) {
        const request = new Request(`${authBaseURL}/users/${userId}`, { method: 'DELETE' });
        return fetch(request);
      }

      it('should support deleting users by id', async () => {
        const deleteHandler = await authInterceptor.delete(`/users/${user.id}`).respond({ status: 204 }).times(1);

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(204);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({});

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].response.body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<WebSocketResponse<null, never, 204>>();
        expect(deleteHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await deleteHandler.requests[0].response.raw.text()).toBe('');
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const deleteHandler = await authInterceptor
          .delete('/users/:userId')
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(404);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(deleteHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
        >();
        expect(deleteHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<NotFoundError>>();
        expect(await deleteHandler.requests[0].response.raw.json()).toEqual(notFoundError);
      });
    });
  });

  describe('Notifications', () => {
    const notification: Notification = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      content: 'Notification content',
    };

    describe('Notification list', () => {
      beforeEach(async () => {
        await notificationInterceptor.get('/notifications/:userId').respond({
          status: 200,
          body: [],
        });
      });

      async function listNotifications(userId: string) {
        const request = new Request(`${notificationBaseURL}/notifications/${encodeURIComponent(userId)}`, {
          method: 'GET',
        });
        return fetch(request);
      }

      it('should list notifications', async () => {
        const listHandler = await notificationInterceptor
          .get('/notifications/:userId')
          .respond({ status: 200, body: [notification] })
          .times(0, 1);

        let response = await listNotifications(notification.userId);
        expect(response.status).toBe(200);

        let returnedNotifications = (await response.json()) as Notification[];
        expect(returnedNotifications).toEqual([notification]);

        expect(listHandler.requests).toHaveLength(1);
        expect(listHandler.requests[0].url).toBe(`${notificationBaseURL}/notifications/${notification.userId}`);

        expectTypeOf(listHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(listHandler.requests[0].pathParams).toEqual({ userId: notification.userId });

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<WebSocketHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<WebSocketSearchParams<never>>();
        expect(listHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<WebSocketRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<Notification[]>();
        expect(listHandler.requests[0].response.body).toEqual([notification]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          WebSocketResponse<Notification[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<Notification[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual([notification]);

        await listHandler.clear();

        response = await listNotifications(notification.userId);
        expect(response.status).toBe(200);

        returnedNotifications = (await response.json()) as Notification[];
        expect(returnedNotifications).toEqual([]);

        expect(listHandler.requests).toHaveLength(0);
      });
    });
  });
*/
}
