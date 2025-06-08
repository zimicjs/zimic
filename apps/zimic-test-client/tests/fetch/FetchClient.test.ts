import { createFetch, FetchResponseError } from '@zimic/fetch';
import { JSONSerialized, HttpHeaders, HttpSearchParams, HttpRequest, HttpResponse } from '@zimic/http';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import expectToThrow from '@zimic/utils/error/expectToThrow';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import {
  AuthServiceSchema,
  ConflictError,
  NotFoundError,
  Notification,
  NotificationServiceSchema,
  User,
  UserCreationRequestBody,
  UserListSearchParams,
  UserUpdatePayload,
  ValidationError,
} from '@tests/types/schema';
import { importCrypto } from '@tests/utils/crypto';
import { expectResponseStatus } from '@tests/utils/requests';

describe('Fetch client', async () => {
  const crypto = await importCrypto();

  const authFetch = createFetch<AuthServiceSchema>({
    baseURL: 'http://localhost:3000',
  });

  const authInterceptor = createHttpInterceptor<AuthServiceSchema>({
    baseURL: authFetch.defaults.baseURL,
    requestSaving: { enabled: true },
  });

  const notificationFetch = createFetch<NotificationServiceSchema>({
    baseURL: 'http://localhost:3001',
  });

  const notificationInterceptor = createHttpInterceptor<NotificationServiceSchema>({
    baseURL: notificationFetch.defaults.baseURL,
    requestSaving: { enabled: true },
  });

  const interceptors = [authInterceptor, notificationInterceptor];

  beforeAll(async () => {
    await Promise.all(interceptors.map((interceptor) => interceptor.start()));
  });

  beforeEach(() => {
    for (const interceptor of interceptors) {
      interceptor.clear();
    }
  });

  afterEach(() => {
    for (const interceptor of interceptors) {
      interceptor.checkTimes();
    }
  });

  afterAll(async () => {
    await Promise.all(interceptors.map((interceptor) => interceptor.stop()));
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
        const response = await authFetch('/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should support creating users', async () => {
        const creationHandler = authInterceptor
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
        expectTypeOf(response.status).toEqualTypeOf<201>();
        expectResponseStatus(response, 201);

        const createdUser = await response.json();
        expect(createdUser).toEqual<JSONSerialized<User>>({
          id: expect.any(String),
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

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(creationHandler.requests[0].response.body).toEqual(createdUser);

        expectTypeOf(creationHandler.requests[0].response.raw).branded.toEqualTypeOf<
          HttpResponse<JSONSerialized<User>, { 'x-user-id': User['id']; 'content-type': 'application/json' }, 201>
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

        const creationHandler = authInterceptor
          .post('/users')
          .with({ body: invalidPayload })
          .respond({ status: 400, body: validationError })
          .times(1);

        const error = await expectToThrow(
          createUser(invalidPayload),
          (error): error is FetchResponseError<AuthServiceSchema, 'POST', '/users'> =>
            authFetch.isResponseError(error, 'POST', '/users'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<400 | 409 | 500>();
        expectResponseStatus(error.response, 400);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(invalidPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ValidationError>();
        expect(creationHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<ValidationError, { 'content-type': 'application/json' }, 400>
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

        const creationHandler = authInterceptor
          .post('/users')
          .with({ body: conflictingPayload })
          .respond({ status: 409, body: conflictError })
          .times(1);

        const error = await expectToThrow(
          createUser(conflictingPayload),
          (error): error is FetchResponseError<AuthServiceSchema, 'POST', '/users'> =>
            authFetch.isResponseError(error, 'POST', '/users'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<400 | 409 | 500>();
        expectResponseStatus(error.response, 409);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationRequestBody>();
        expect(creationHandler.requests[0].body).toEqual(conflictingPayload);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationRequestBody, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationRequestBody>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ConflictError>();
        expect(creationHandler.requests[0].response.body).toEqual(conflictError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<ConflictError, { 'content-type': 'application/json' }, 409>
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

      beforeEach(() => {
        authInterceptor.get('/users').respond({
          status: 200,
          body: [],
        });
      });

      async function listUsers(filters: UserListSearchParams = {}) {
        const response = await authFetch('/users', {
          method: 'GET',
          searchParams: filters,
        });

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should list users', async () => {
        const listHandler = authInterceptor
          .get('/users')
          .respond({ status: 200, body: users.map(serializeUser) })
          .times(1);

        const response = await listUsers();
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        const returnedUsers = await response.json();
        expect(returnedUsers).toEqual(users.map(serializeUser));

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(users.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual(users.map(serializeUser));
      });

      it('should list users filtered by name', async () => {
        const user = users[0];

        const listHandler = authInterceptor
          .get('/users')
          .with({ searchParams: { name: user.name } })
          .respond({ status: 200, body: [serializeUser(user)] })
          .times(1);

        const response = await listUsers({ name: user.name });
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        const returnedUsers = await response.json();
        expect(returnedUsers).toEqual([serializeUser(user)]);

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(user.name);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual([]);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual([serializeUser(user)]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<JSONSerialized<User>[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual([serializeUser(user)]);
      });

      it('should list users with ordering', async () => {
        const usersSortedByDescendingEmail = [...users].sort((user, otherUser) => {
          return otherUser.email.localeCompare(user.email);
        });

        const listHandler = authInterceptor
          .get('/users')
          .with({ searchParams: { orderBy: ['email.desc'] } })
          .respond({
            status: 200,
            body: usersSortedByDescendingEmail.map(serializeUser),
          })
          .times(1);

        const response = await listUsers({
          orderBy: ['email.desc'],
        });
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        const returnedUsers = await response.json();
        expect(returnedUsers).toEqual(usersSortedByDescendingEmail.map(serializeUser));

        expect(listHandler.requests).toHaveLength(1);

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<UserListSearchParams>>();
        expect(listHandler.requests[0].searchParams.size).toBe(1);
        expect(listHandler.requests[0].searchParams.get('name')).toBe(null);
        expect(listHandler.requests[0].searchParams.getAll('orderBy')).toEqual(['email.desc']);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>[]>();
        expect(listHandler.requests[0].response.body).toEqual(usersSortedByDescendingEmail.map(serializeUser));

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<JSONSerialized<User>[], { 'content-type': 'application/json' }, 200>
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
        const response = await authFetch(`/users/${userId}`, { method: 'GET' });

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should support getting users by id', async () => {
        const getHandler = authInterceptor
          .get(`/users/${user.id}`)
          .respond({
            status: 200,
            body: serializeUser(user),
          })
          .times(1);

        const response = await getUserById(user.id);
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        const returnedUsers = await response.json();
        expect(returnedUsers).toEqual(serializeUser(user));

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${authFetch.defaults.baseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<JSONSerialized<User>>();
        expect(getHandler.requests[0].response.body).toEqual(serializeUser(user));

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<JSONSerialized<User>, { 'content-type': 'application/json' }, 200>
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

        const getHandler = authInterceptor
          .get('/users/:userId')
          .respond({
            status: 404,
            body: notFoundError,
          })
          .times(1);

        const error = await expectToThrow(
          getUserById(user.id),
          (error): error is FetchResponseError<AuthServiceSchema, 'GET', '/users/:userId'> =>
            authFetch.isResponseError(error, 'GET', '/users/:userId'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<404 | 500>();
        expectResponseStatus(error.response, 404);

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${authFetch.defaults.baseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(getHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(getHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(getHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(getHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
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

      async function updateUser(userId: string, payload: Partial<UserCreationRequestBody>) {
        const response = await authFetch(`/users/${userId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should support updating users', async () => {
        const updateHandler = authInterceptor
          .patch(`/users/${user.id}`)
          .with({
            headers: { 'content-type': 'application/json' },
            body: updatePayload,
          })
          .respond((request) => {
            expect(request.headers.get('content-type')).toBe('application/json');

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
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        const updatedUser = await response.json();
        expect(updatedUser).toEqual<JSONSerialized<User>>({
          ...serializeUser(user),
          ...updatePayload,
        });

        expect(updateHandler.requests).toHaveLength(1);

        expectTypeOf(updateHandler.requests[0].headers).branded.toEqualTypeOf<
          HttpHeaders<{ 'content-type': string }>
        >();

        expectTypeOf(updateHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(updateHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(updateHandler.requests[0].body).toEqualTypeOf<UserUpdatePayload>();
        expect(updateHandler.requests[0].body).toEqual(updatePayload);
      });

      it('should return an error if user not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const updateHandler = authInterceptor
          .patch('/users/:userId')
          .with({ body: updatePayload })
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const error = await expectToThrow(
          updateUser(crypto.randomUUID(), updatePayload),
          (error): error is FetchResponseError<AuthServiceSchema, 'PATCH', '/users/:userId'> =>
            authFetch.isResponseError(error, 'PATCH', '/users/:userId'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<400 | 404 | 500>();
        expectResponseStatus(error.response, 404);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(notFoundError);
      });

      it('should return an error if payload is invalid', async () => {
        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid payload',
        };

        const updateHandler = authInterceptor
          .patch('/users/:userId')
          .with({ body: {} })
          .respond({ status: 400, body: validationError })
          .times(1);

        const error = await expectToThrow(
          updateUser(user.id, {}),
          (error): error is FetchResponseError<AuthServiceSchema, 'PATCH', '/users/:userId'> =>
            authFetch.isResponseError(error, 'PATCH', '/users/:userId'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<400 | 404 | 500>();
        expectResponseStatus(error.response, 400);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(validationError);
      });
    });

    describe('User deletion', () => {
      async function deleteUserById(userId: string) {
        const request = new authFetch.Request(`/users/${userId}`, { method: 'DELETE' });
        const response = await authFetch(request);

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should support deleting users by id', async () => {
        const deleteHandler = authInterceptor.delete(`/users/${user.id}`).respond({ status: 204 }).times(1);

        const response = await deleteUserById(user.id);
        expectTypeOf(response.status).toEqualTypeOf<204>();
        expectResponseStatus(response, 204);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${authFetch.defaults.baseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({});

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].response.body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<null, never, 204>>();
        expect(deleteHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteHandler.requests[0].response.raw.text()).toBe('');
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };
        const deleteHandler = authInterceptor
          .delete('/users/:userId')
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const error = await expectToThrow(
          deleteUserById(user.id),
          (error): error is FetchResponseError<AuthServiceSchema, 'DELETE', '/users/:userId'> =>
            authFetch.isResponseError(error, 'DELETE', '/users/:userId'),
        );

        expectTypeOf(error.response.status).toEqualTypeOf<404 | 500>();
        expectResponseStatus(error.response, 404);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${authFetch.defaults.baseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<NotFoundError>();
        expect(deleteHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
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
      beforeEach(() => {
        notificationInterceptor.get('/notifications/:userId').respond({
          status: 200,
          body: [],
        });
      });

      async function listNotifications(userId: string) {
        const request = new notificationFetch.Request(`/notifications/${encodeURIComponent(userId)}`, {
          method: 'GET',
        });

        const response = await notificationFetch(request);

        if (!response.ok) {
          throw response.error;
        }

        return response;
      }

      it('should list notifications', async () => {
        const listHandler = notificationInterceptor
          .get('/notifications/:userId')
          .respond({
            status: 200,
            body: [notification],
          })
          .times(0, 1);

        let response = await listNotifications(notification.userId);
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        let returnedNotifications = await response.json();
        expect(returnedNotifications).toEqual([notification]);

        expect(listHandler.requests).toHaveLength(1);
        expect(listHandler.requests[0].url).toBe(
          `${notificationFetch.defaults.baseURL}/notifications/${notification.userId}`,
        );

        expectTypeOf(listHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(listHandler.requests[0].pathParams).toEqual({ userId: notification.userId });

        expectTypeOf(listHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(listHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(listHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(listHandler.requests[0].body).toEqualTypeOf<null>();
        expect(listHandler.requests[0].body).toBe(null);

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<Notification[]>();
        expect(listHandler.requests[0].response.body).toEqual([notification]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<Notification[], { 'content-type': 'application/json' }, 200>
        >();
        expect(listHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<Notification[]>>();
        expect(await listHandler.requests[0].response.raw.json()).toEqual([notification]);

        listHandler.clear();

        response = await listNotifications(notification.userId);
        expectTypeOf(response.status).toEqualTypeOf<200>();
        expectResponseStatus(response, 200);

        returnedNotifications = await response.json();
        expect(returnedNotifications).toEqual([]);

        expect(listHandler.requests).toHaveLength(0);
      });
    });
  });
});
