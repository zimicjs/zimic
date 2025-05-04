import { JSONSerialized, HttpHeaders, HttpRequest, HttpResponse, HttpSearchParams } from '@zimic/http';
import { createHttpInterceptor, HttpInterceptorType } from '@zimic/interceptor/http';
import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf, afterEach } from 'vitest';

import {
  AuthServiceSchema,
  NotificationServiceSchema,
  User,
  UserCreationRequestBody,
  ValidationError,
  ConflictError,
  UserListSearchParams,
  NotFoundError,
  Notification,
} from '@tests/types/schema';
import { importCrypto, IsomorphicCrypto } from '@tests/utils/crypto';

import { ClientTestOptionsByWorkerType, ZIMIC_SERVER_PORT } from '.';

function getAuthBaseURL(type: HttpInterceptorType, crypto: IsomorphicCrypto) {
  return type === 'local'
    ? 'http://localhost:3000'
    : `http://localhost:${ZIMIC_SERVER_PORT}/auth-${crypto.randomUUID()}`;
}

function getNotificationsBaseURL(type: HttpInterceptorType, crypto: IsomorphicCrypto) {
  return type === 'local'
    ? 'http://localhost:3001'
    : `http://localhost:${ZIMIC_SERVER_PORT}/notifications-${crypto.randomUUID()}`;
}

async function declareHttpInterceptorTests(options: ClientTestOptionsByWorkerType) {
  const { platform, type, fetch } = options;

  const crypto = await importCrypto();

  const authInterceptor = createHttpInterceptor<AuthServiceSchema>({
    type,
    baseURL: getAuthBaseURL(type, crypto),
    requestSaving: { enabled: true },
  });

  const notificationInterceptor = createHttpInterceptor<NotificationServiceSchema>({
    type,
    baseURL: getNotificationsBaseURL(type, crypto),
    requestSaving: { enabled: true },
  });

  const interceptors = [authInterceptor, notificationInterceptor];

  const authBaseURL = authInterceptor.baseURL;
  const notificationBaseURL = notificationInterceptor.baseURL;

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
    await Promise.all(
      interceptors.map(async (interceptor) => {
        await interceptor.stop();
        expect(interceptor.isRunning).toBe(false);
      }),
    );
  });

  function serializeUser(user: User): JSONSerialized<User> {
    return {
      ...user,
      birthDate: user.birthDate.toISOString(),
    };
  }

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

      async function createUser(payload: UserCreationRequestBody) {
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
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expect(response.headers.get('x-user-id')).toBe(createdUser.id);
        expect(creationHandler.requests[0].response.headers.get('x-user-id')).toBe(createdUser.id);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<HttpRequest<UserCreationRequestBody>>();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(creationHandler.requests[0].response.body).toEqual(createdUser);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>, 201>>();
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
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<HttpRequest<UserCreationRequestBody>>();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ValidationError>();
        expect(creationHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<ValidationError, 400>>();
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
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(conflictingPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<HttpRequest<UserCreationRequestBody>>();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ConflictError>();
        expect(creationHandler.requests[0].response.body).toEqual(conflictError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<ConflictError, 409>>();
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
        const searchParams = new HttpSearchParams<UserListSearchParams>(filters);
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

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(users.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
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

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(user.name);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual([serializeUser(user)]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
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

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual(['email.desc']);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(usersSortedByDescendingEmail.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>[], 200>>();
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

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(getHandler.requests[0].response.body).toEqual(serializeUser(user));

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<JSONSerialized<User>, 200>>();
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

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(getHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<NotFoundError, 404>>();
        expect(getHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<NotFoundError>>();
        expect(await getHandler.requests[0].response.raw.json()).toEqual(notFoundError);
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

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].response.body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<null, 204>>();
        expect(deleteHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<null>>();
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

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(deleteHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<NotFoundError, 404>>();
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

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(listHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<Notification[]>();
        expect(listHandler.requests[0].response.body).toEqual([notification]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<Notification[], 200>>();
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
}

export default declareHttpInterceptorTests;
