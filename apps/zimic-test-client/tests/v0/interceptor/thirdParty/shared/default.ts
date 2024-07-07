import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf } from 'vitest';
import { JSONSerialized } from 'zimic0';
import { HttpRequest, HttpResponse, HttpSearchParams } from 'zimic0/http';
import { http, HttpInterceptorType } from 'zimic0/interceptor/http';

import { importCrypto } from '@tests/utils/crypto';

import { ClientTestOptionsByWorkerType, ZIMIC_SERVER_PORT } from '.';
import {
  AuthServiceSchema,
  NotificationServiceSchema,
  User,
  UserCreationPayload,
  ValidationError,
  ConflictError,
  UserListSearchParams,
  NotFoundError,
  Notification,
} from './schema';

async function getAuthBaseURL(type: HttpInterceptorType) {
  const crypto = await importCrypto();

  return type === 'local'
    ? 'http://localhost:3000'
    : `http://localhost:${ZIMIC_SERVER_PORT}/auth-${crypto.randomUUID()}`;
}

async function getNotificationsBaseURL(type: HttpInterceptorType) {
  const crypto = await importCrypto();

  return type === 'local'
    ? 'http://localhost:3001'
    : `http://localhost:${ZIMIC_SERVER_PORT}/notifications-${crypto.randomUUID()}`;
}

async function declareDefaultClientTests(options: ClientTestOptionsByWorkerType) {
  const { platform, type, fetch } = options;

  const authInterceptor = http.createInterceptor<AuthServiceSchema>({
    type,
    baseURL: await getAuthBaseURL(type),
    saveRequests: true,
  });

  const notificationInterceptor = http.createInterceptor<NotificationServiceSchema>({
    type,
    baseURL: await getNotificationsBaseURL(type),
    saveRequests: true,
  });

  const interceptors = [authInterceptor, notificationInterceptor];

  const authBaseURL = authInterceptor.baseURL();
  const notificationBaseURL = notificationInterceptor.baseURL();

  beforeAll(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.start();
        expect(interceptor.isRunning()).toBe(true);
        expect(interceptor.platform()).toBe(platform);
      }),
    );
  });

  beforeEach(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.clear();
      }),
    );
  });

  afterAll(async () => {
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning()).toBe(false);
      }),
    );
  });

  function serializeUser(user: User): JSONSerialized<User> {
    return {
      ...user,
      birthDate: user.birthDate.toISOString(),
    };
  }

  describe('Users', async () => {
    const crypto = await importCrypto();

    const user: User = {
      id: crypto.randomUUID(),
      name: 'Name',
      email: 'email@email.com',
      birthDate: new Date(),
    };

    describe('User creation', () => {
      const creationPayload: UserCreationPayload = {
        name: user.name,
        email: user.email,
        password: crypto.randomUUID(),
        birthDate: new Date().toISOString(),
      };

      async function createUser(payload: UserCreationPayload) {
        const request = new Request(`${authBaseURL}/users`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        return fetch(request);
      }

      it('should support creating users', async () => {
        const creationHandler = await authInterceptor
          .post('/users')
          .with({
            headers: { 'content-type': 'application/json' },
            body: creationPayload,
          })
          .respond((request) => {
            expect(request.headers.get('content-type')).toBe('application/json');

            const user: JSONSerialized<User> = {
              id: crypto.randomUUID(),
              name: request.body.name,
              email: request.body.email,
              birthDate: request.body.birthDate,
            };

            return {
              status: 201,
              headers: { 'x-user-id': user.id },
              body: user,
            };
          });

        const response = await createUser(creationPayload);
        expect(response.status).toBe(201);

        const createdUser = (await response.json()) as User;
        expect(createdUser).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationPayload.name,
          email: creationPayload.email,
          birthDate: creationPayload.birthDate,
        });

        const creationRequests = await creationHandler.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(creationRequests[0].searchParams.size).toBe(0);

        expect(response.headers.get('x-user-id')).toBe(createdUser.id);
        expect(creationRequests[0].response.headers.get('x-user-id')).toBe(createdUser.id);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(creationPayload);

        expectTypeOf(creationRequests[0].raw).toEqualTypeOf<HttpRequest<UserCreationPayload>>();
        expect(creationRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationRequests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationPayload>>();
        expect(await creationRequests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(creationRequests[0].response.body).toEqual(createdUser);

        expectTypeOf(creationRequests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>, 201>>();
        expect(creationRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationRequests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>>>();
        expect(await creationRequests[0].response.raw.json()).toEqual(createdUser);
      });

      it('should return an error if the payload is not valid', async () => {
        // @ts-expect-error Forcing an invalid payload
        const invalidPayload: UserCreationPayload = {};

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid payload',
        };
        const creationHandler = await authInterceptor
          .post('/users')
          .with({
            body: invalidPayload,
          })
          .respond({
            status: 400,
            body: validationError,
          });

        const response = await createUser(invalidPayload);
        expect(response.status).toBe(400);

        const creationRequests = await creationHandler.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(creationRequests[0].searchParams.size).toBe(0);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(invalidPayload);

        expectTypeOf(creationRequests[0].raw).toEqualTypeOf<HttpRequest<UserCreationPayload>>();
        expect(creationRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationRequests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationPayload>>();
        expect(await creationRequests[0].raw.json()).toEqual(invalidPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<ValidationError>();
        expect(creationRequests[0].response.body).toEqual(validationError);

        expectTypeOf(creationRequests[0].response.raw).toEqualTypeOf<HttpResponse<ValidationError, 400>>();
        expect(creationRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationRequests[0].response.raw.json).toEqualTypeOf<() => Promise<ValidationError>>();
        expect(await creationRequests[0].response.raw.json()).toEqual(validationError);
      });

      it('should return an error if the payload is not valid', async () => {
        const conflictingPayload: UserCreationPayload = creationPayload;

        const conflictError: ConflictError = {
          code: 'conflict',
          message: 'User already exists',
        };
        const creationHandler = await authInterceptor
          .post('/users')
          .with({
            body: conflictingPayload,
          })
          .respond({
            status: 409,
            body: conflictError,
          });

        const response = await createUser(conflictingPayload);
        expect(response.status).toBe(409);

        const creationRequests = await creationHandler.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(creationRequests[0].searchParams.size).toBe(0);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(conflictingPayload);

        expectTypeOf(creationRequests[0].raw).toEqualTypeOf<HttpRequest<UserCreationPayload>>();
        expect(creationRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationRequests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationPayload>>();
        expect(await creationRequests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<ConflictError>();
        expect(creationRequests[0].response.body).toEqual(conflictError);

        expectTypeOf(creationRequests[0].response.raw).toEqualTypeOf<HttpResponse<ConflictError, 409>>();
        expect(creationRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationRequests[0].response.raw.json).toEqualTypeOf<() => Promise<ConflictError>>();
        expect(await creationRequests[0].response.raw.json()).toEqual(conflictError);
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
        const searchParams = new HttpSearchParams(filters);
        const request = new Request(`${authBaseURL}/users?${searchParams.toString()}`, {
          method: 'GET',
        });
        return fetch(request);
      }

      it('should list users', async () => {
        const listHandler = await authInterceptor.get('/users').respond({
          status: 200,
          body: users.map(serializeUser),
        });

        const response = await listUsers();
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(users.map(serializeUser));

        const listRequests = await listHandler.requests();
        expect(listRequests).toHaveLength(1);

        expectTypeOf(listRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listRequests[0].searchParams.get('name')).toBe(null);
        expect(listRequests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listRequests[0].body).toEqualTypeOf<null>();
        expect(listRequests[0].body).toBe(null);

        expectTypeOf(listRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listRequests[0].raw.text()).toBe('');

        expectTypeOf(listRequests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listRequests[0].response.body).toEqual(users.map(serializeUser));

        expectTypeOf(listRequests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
        expect(listRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listRequests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listRequests[0].response.raw.json()).toEqual(users.map(serializeUser));
      });

      it('should list users filtered by name', async () => {
        const user = users[0];

        const listHandler = authInterceptor
          .get('/users')
          .with({
            searchParams: { name: user.name },
          })
          .respond({
            status: 200,
            body: [serializeUser(user)],
          });

        const response = await listUsers({ name: user.name });
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual([serializeUser(user)]);

        const listRequests = await listHandler.requests();
        expect(listRequests).toHaveLength(1);

        expectTypeOf(listRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listRequests[0].searchParams.size).toBe(1);
        expect(listRequests[0].searchParams.get('name')).toBe(user.name);
        expect(listRequests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listRequests[0].body).toEqualTypeOf<null>();
        expect(listRequests[0].body).toBe(null);

        expectTypeOf(listRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listRequests[0].raw.text()).toBe('');

        expectTypeOf(listRequests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listRequests[0].response.body).toEqual([serializeUser(user)]);

        expectTypeOf(listRequests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
        expect(listRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listRequests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listRequests[0].response.raw.json()).toEqual([serializeUser(user)]);
      });

      it('should list users with ordering', async () => {
        const orderedUsers = users.sort((user, otherUser) => {
          return -user.email.localeCompare(otherUser.email);
        });

        const listHandler = authInterceptor
          .get('/users')
          .with({
            searchParams: { orderBy: ['email.desc'] },
          })
          .respond({
            status: 200,
            body: orderedUsers.map(serializeUser),
          });

        const response = await listUsers({
          orderBy: ['email.desc'],
        });
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(orderedUsers.map(serializeUser));

        const listRequests = await listHandler.requests();
        expect(listRequests).toHaveLength(1);

        expectTypeOf(listRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listRequests[0].searchParams.size).toBe(1);
        expect(listRequests[0].searchParams.get('name')).toBe(null);
        expect(listRequests[0].searchParams.getAll('orderBy')).toEqual(['email.desc']);

        expectTypeOf(listRequests[0].body).toEqualTypeOf<null>();
        expect(listRequests[0].body).toBe(null);

        expectTypeOf(listRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listRequests[0].raw.text()).toBe('');

        expectTypeOf(listRequests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listRequests[0].response.body).toEqual(orderedUsers.map(serializeUser));

        expectTypeOf(listRequests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
        expect(listRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listRequests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listRequests[0].response.raw.json()).toEqual(orderedUsers.map(serializeUser));
      });
    });

    describe('User get by id', () => {
      async function getUserById(userId: string) {
        const request = new Request(`${authBaseURL}/users/${userId}`, { method: 'GET' });
        return fetch(request);
      }

      it('should support getting users by id', async () => {
        const getHandler = await authInterceptor.get(`/users/${user.id}`).respond({
          status: 200,
          body: serializeUser(user),
        });

        const response = await getUserById(user.id);
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(serializeUser(user));

        const getRequests = await getHandler.requests();
        expect(getRequests).toHaveLength(1);
        expect(getRequests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(getRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(getRequests[0].searchParams.size).toBe(0);

        expectTypeOf(getRequests[0].body).toEqualTypeOf<null>();
        expect(getRequests[0].body).toBe(null);

        expectTypeOf(getRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(getRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getRequests[0].raw.text()).toBe('');

        expectTypeOf(getRequests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(getRequests[0].response.body).toEqual(serializeUser(user));

        expectTypeOf(getRequests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>, 200>>();
        expect(getRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getRequests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>>>();
        expect(await getRequests[0].response.raw.json()).toEqual(serializeUser(user));
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };
        const getHandler = await authInterceptor.get('/users/:id').respond({
          status: 404,
          body: notFoundError,
        });

        const response = await getUserById(user.id);
        expect(response.status).toBe(404);

        const getRequests = await getHandler.requests();
        expect(getRequests).toHaveLength(1);
        expect(getRequests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(getRequests[0].pathParams).toEqualTypeOf<{ id: string }>();
        expect(getRequests[0].pathParams).toEqual({ id: user.id });

        expectTypeOf(getRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(getRequests[0].searchParams.size).toBe(0);

        expectTypeOf(getRequests[0].body).toEqualTypeOf<null>();
        expect(getRequests[0].body).toBe(null);

        expectTypeOf(getRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(getRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getRequests[0].raw.text()).toBe('');

        expectTypeOf(getRequests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(getRequests[0].response.body).toEqual(notFoundError);

        expectTypeOf(getRequests[0].response.raw).toEqualTypeOf<HttpResponse<NotFoundError, 404>>();
        expect(getRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getRequests[0].response.raw.json).toEqualTypeOf<() => Promise<NotFoundError>>();
        expect(await getRequests[0].response.raw.json()).toEqual(notFoundError);
      });
    });

    describe('User deletion', () => {
      async function deleteUserById(userId: string) {
        const request = new Request(`${authBaseURL}/users/${userId}`, { method: 'DELETE' });
        return fetch(request);
      }

      it('should support deleting users by id', async () => {
        const deleteHandler = await authInterceptor.delete(`/users/${user.id}`).respond({
          status: 204,
        });

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(204);

        const deleteRequests = await deleteHandler.requests();
        expect(deleteRequests).toHaveLength(1);
        expect(deleteRequests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(deleteRequests[0].pathParams).toEqualTypeOf<{ id: string }>();
        expect(deleteRequests[0].pathParams).toEqual({});

        expectTypeOf(deleteRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(deleteRequests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteRequests[0].body).toEqualTypeOf<null>();
        expect(deleteRequests[0].body).toBe(null);

        expectTypeOf(deleteRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(deleteRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteRequests[0].raw.text()).toBe('');

        expectTypeOf(deleteRequests[0].response.body).toEqualTypeOf<null>();
        expect(deleteRequests[0].response.body).toBe(null);

        expectTypeOf(deleteRequests[0].response.raw).toEqualTypeOf<HttpResponse<null, 204>>();
        expect(deleteRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteRequests[0].response.raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteRequests[0].response.raw.text()).toBe('');
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };
        const getHandler = await authInterceptor.delete('/users/:id').respond({
          status: 404,
          body: notFoundError,
        });

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(404);

        const deleteRequests = await getHandler.requests();
        expect(deleteRequests).toHaveLength(1);
        expect(deleteRequests[0].url).toBe(`${authBaseURL}/users/${user.id}`);

        expectTypeOf(deleteRequests[0].pathParams).toEqualTypeOf<{ id: string }>();
        expect(deleteRequests[0].pathParams).toEqual({ id: user.id });

        expectTypeOf(deleteRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(deleteRequests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteRequests[0].body).toEqualTypeOf<null>();
        expect(deleteRequests[0].body).toBe(null);

        expectTypeOf(deleteRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(deleteRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteRequests[0].raw.text()).toBe('');

        expectTypeOf(deleteRequests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(deleteRequests[0].response.body).toEqual(notFoundError);

        expectTypeOf(deleteRequests[0].response.raw).toEqualTypeOf<HttpResponse<NotFoundError, 404>>();
        expect(deleteRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteRequests[0].response.raw.json).toEqualTypeOf<() => Promise<NotFoundError>>();
        expect(await deleteRequests[0].response.raw.json()).toEqual(notFoundError);
      });
    });
  });

  describe('Notifications', async () => {
    const crypto = await importCrypto();

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
        const listHandler = await notificationInterceptor.get('/notifications/:userId').respond({
          status: 200,
          body: [notification],
        });

        let response = await listNotifications(notification.userId);
        expect(response.status).toBe(200);

        let returnedNotifications = (await response.json()) as Notification[];
        expect(returnedNotifications).toEqual([notification]);

        const listRequests = await listHandler.requests();
        expect(listRequests).toHaveLength(1);
        expect(listRequests[0].url).toBe(`${notificationBaseURL}/notifications/${notification.userId}`);

        expectTypeOf(listRequests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(listRequests[0].pathParams).toEqual({ userId: notification.userId });

        expectTypeOf(listRequests[0].searchParams).toEqualTypeOf<HttpSearchParams<{}>>();
        expect(listRequests[0].searchParams.size).toBe(0);

        expectTypeOf(listRequests[0].body).toEqualTypeOf<null>();
        expect(listRequests[0].body).toBe(null);

        expectTypeOf(listRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listRequests[0].raw.text()).toBe('');

        expectTypeOf(listRequests[0].response.body).toEqualTypeOf<Notification[]>();
        expect(listRequests[0].response.body).toEqual([notification]);

        expectTypeOf(listRequests[0].response.raw).toEqualTypeOf<HttpResponse<Notification[], 200>>();
        expect(listRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listRequests[0].response.raw.json).toEqualTypeOf<() => Promise<Notification[]>>();
        expect(await listRequests[0].response.raw.json()).toEqual([notification]);

        await listHandler.bypass();

        response = await listNotifications(notification.userId);
        expect(response.status).toBe(200);

        returnedNotifications = (await response.json()) as Notification[];
        expect(returnedNotifications).toEqual([]);

        expect(listRequests).toHaveLength(1);
        expect(await listHandler.requests()).toHaveLength(1);

        await listHandler.clear();

        response = await listNotifications(notification.userId);
        expect(response.status).toBe(200);

        returnedNotifications = (await response.json()) as Notification[];
        expect(returnedNotifications).toEqual([]);

        expect(listRequests).toHaveLength(1);
        expect(await listHandler.requests()).toHaveLength(0);
      });
    });
  });
}

export default declareDefaultClientTests;
