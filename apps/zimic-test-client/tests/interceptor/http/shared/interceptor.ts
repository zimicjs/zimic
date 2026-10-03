import { JSONSerialized, HttpHeaders, HttpRequest, HttpResponse, HttpSearchParams } from '@zimic/http';
import { createHttpInterceptor, HttpInterceptorType } from '@zimic/interceptor/http';
import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf, afterEach } from 'vitest';

import { ZIMIC_SERVER_PORT } from '@tests/constants';
import {
  User,
  UserCreationInput,
  ValidationError,
  ConflictError,
  UserListSearchParams,
  NotFoundError,
  UserUpdateInput,
  Notification,
} from '@tests/types/schema/entities';
import { UserHttpSchema, NotificationHttpSchema } from '@tests/types/schema/http';
import { serializeUser } from '@tests/utils/schema';

import { ClientTestOptionsByWorkerType } from './client';

function getUserBaseURL(type: HttpInterceptorType) {
  return type === 'local'
    ? 'http://localhost:4000'
    : `http://localhost:${ZIMIC_SERVER_PORT}/user-${crypto.randomUUID()}`;
}

function getNotificationBaseURL(type: HttpInterceptorType) {
  return type === 'local'
    ? 'http://localhost:4001'
    : `http://localhost:${ZIMIC_SERVER_PORT}/notification-${crypto.randomUUID()}`;
}

export function declareHttpInterceptorTests({ platform, type }: ClientTestOptionsByWorkerType) {
  const userInterceptor = createHttpInterceptor<UserHttpSchema>({
    type,
    baseURL: getUserBaseURL(type),
    requestSaving: { enabled: true },
  });

  const notificationInterceptor = createHttpInterceptor<NotificationHttpSchema>({
    type,
    baseURL: getNotificationBaseURL(type),
    requestSaving: { enabled: true },
  });

  const interceptors = [userInterceptor, notificationInterceptor];

  const userBaseURL = userInterceptor.baseURL;
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
        const request = new Request(`${userBaseURL}/users`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(input),
        });

        return fetch(request);
      }

      it('should support creating users', async () => {
        const creationHandler = await userInterceptor
          .post('/users')
          .with({
            headers: { 'content-type': 'application/json' },
            body: creationInput,
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

        const response = await createUser(creationInput);
        expect(response.status).toBe(201);

        const createdUser = (await response.json()) as User;
        expect(createdUser).toEqual<JSONSerialized<User>>({
          id: expect.any(String) as string,
          name: creationInput.name,
          email: creationInput.email,
          birthDate: creationInput.birthDate,
        });

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expect(response.headers.get('x-user-id')).toBe(createdUser.id);
        expect(creationHandler.requests[0].response.headers.get('x-user-id')).toBe(createdUser.id);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationInput>();
        expect(creationHandler.requests[0].body).toEqual(creationInput);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationInput, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationInput>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationInput);

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

      it('should return an error if the input is not valid', async () => {
        // @ts-expect-error Forcing an invalid input
        const invalidInput: UserCreationInput = {};

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid input',
        };

        const creationHandler = await userInterceptor
          .post('/users')
          .with({ body: invalidInput })
          .respond({ status: 400, body: validationError })
          .times(1);

        const response = await createUser(invalidInput);
        expect(response.status).toBe(400);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationInput>();
        expect(creationHandler.requests[0].body).toEqual(invalidInput);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationInput, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationInput>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(invalidInput);

        expectTypeOf(creationHandler.requests[0].response.body).toEqualTypeOf<ValidationError>();
        expect(creationHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(creationHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<ValidationError, { 'content-type': 'application/json' }, 400>
        >();
        expect(creationHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<ValidationError>>();
        expect(await creationHandler.requests[0].response.raw.json()).toEqual(validationError);
      });

      it('should return an error if the input is not valid', async () => {
        const conflictingInput: UserCreationInput = creationInput;

        const conflictError: ConflictError = {
          code: 'conflict',
          message: 'User already exists',
        };
        const creationHandler = await userInterceptor
          .post('/users')
          .with({ body: conflictingInput })
          .respond({ status: 409, body: conflictError })
          .times(1);

        const response = await createUser(conflictingInput);
        expect(response.status).toBe(409);

        expect(creationHandler.requests).toHaveLength(1);

        expectTypeOf(creationHandler.requests[0].headers).toEqualTypeOf<
          HttpHeaders<{ 'content-type': 'application/json' }>
        >();

        expectTypeOf(creationHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(creationHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(creationHandler.requests[0].body).toEqualTypeOf<UserCreationInput>();
        expect(creationHandler.requests[0].body).toEqual(conflictingInput);

        expectTypeOf(creationHandler.requests[0].raw).toEqualTypeOf<
          HttpRequest<UserCreationInput, { 'content-type': 'application/json' }>
        >();
        expect(creationHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationInput>>();
        expect(await creationHandler.requests[0].raw.json()).toEqual(creationInput);

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

      beforeEach(async () => {
        await userInterceptor.get('/users').respond({
          status: 200,
          body: [],
        });
      });

      async function listUsers(filters: UserListSearchParams = {}) {
        const searchParams = new HttpSearchParams<UserListSearchParams>(filters);
        const request = new Request(`${userBaseURL}/users?${searchParams.toString()}`, {
          method: 'GET',
        });
        return fetch(request);
      }

      it('should list users', async () => {
        const listHandler = await userInterceptor
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

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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

        const listHandler = await userInterceptor
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

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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

        const listHandler = await userInterceptor
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

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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
        const request = new Request(`${userBaseURL}/users/${userId}`, { method: 'GET' });
        return fetch(request);
      }

      it('should support getting users by id', async () => {
        const getHandler = await userInterceptor
          .get(`/users/${user.id}`)
          .respond({ status: 200, body: serializeUser(user) })
          .times(1);

        const response = await getUserById(user.id);
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(serializeUser(user));

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${userBaseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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

        const getHandler = await userInterceptor
          .get('/users/:userId')
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await getUserById(user.id);
        expect(response.status).toBe(404);

        expect(getHandler.requests).toHaveLength(1);
        expect(getHandler.requests[0].url).toBe(`${userBaseURL}/users/${user.id}`);

        expectTypeOf(getHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(getHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(getHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(getHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(getHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(getHandler.requests[0].body).toEqualTypeOf<null>();
        expect(getHandler.requests[0].body).toBe(null);

        expectTypeOf(getHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(getHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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
      const updateInput: UserUpdateInput = {
        name: 'Updated Name',
        email: 'updated@email.com',
        birthDate: new Date().toISOString(),
      };

      async function updateUser(userId: string, input: UserUpdateInput) {
        const request = new Request(`${userBaseURL}/users/${userId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        return fetch(request);
      }

      it('should support updating users', async () => {
        const updateHandler = await userInterceptor
          .patch(`/users/${user.id}`)
          .with({
            headers: { 'content-type': 'application/json' },
            body: updateInput,
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

        const response = await updateUser(user.id, updateInput);
        expect(response.status).toBe(200);

        const updatedUser = (await response.json()) as JSONSerialized<User>;
        expect(updatedUser).toEqual<JSONSerialized<User>>({
          ...serializeUser(user),
          ...updateInput,
        });

        expect(updateHandler.requests).toHaveLength(1);

        expectTypeOf(updateHandler.requests[0].headers).branded.toEqualTypeOf<
          HttpHeaders<{ 'content-type': string }>
        >();

        expectTypeOf(updateHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(updateHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(updateHandler.requests[0].body).toEqualTypeOf<UserUpdateInput>();
        expect(updateHandler.requests[0].body).toEqual(updateInput);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<JSONSerialized<User>, { 'content-type': 'application/json' }, 200>
        >();
      });

      it('should return an error if user not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const updateHandler = await userInterceptor
          .patch('/users/:userId')
          .with({ body: updateInput })
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await updateUser(crypto.randomUUID(), updateInput);
        expect(response.status).toBe(404);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(notFoundError);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<NotFoundError, { 'content-type': 'application/json' }, 404>
        >();
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
          .patch('/users/:userId')
          .with({ body: invalidInput })
          .respond({ status: 400, body: validationError })
          .times(1);

        const response = await updateUser(user.id, invalidInput);
        expect(response.status).toBe(400);

        expect(updateHandler.requests).toHaveLength(1);
        expect(updateHandler.requests[0].response.body).toEqual(validationError);

        expectTypeOf(updateHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<ValidationError, { 'content-type': 'application/json' }, 400>
        >();
      });
    });

    describe('User deletion', () => {
      async function deleteUserById(userId: string) {
        const request = new Request(`${userBaseURL}/users/${userId}`, { method: 'DELETE' });
        return fetch(request);
      }

      it('should support deleting users by id', async () => {
        const deleteHandler = await userInterceptor.delete(`/users/${user.id}`).respond({ status: 204 }).times(1);

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(204);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${userBaseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({});

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await deleteHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(deleteHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].response.body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<null, never, 204>>();
        expect(deleteHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(deleteHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await deleteHandler.requests[0].response.raw.text()).toBe('');
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };

        const deleteHandler = await userInterceptor
          .delete('/users/:userId')
          .respond({ status: 404, body: notFoundError })
          .times(1);

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(404);

        expect(deleteHandler.requests).toHaveLength(1);
        expect(deleteHandler.requests[0].url).toBe(`${userBaseURL}/users/${user.id}`);

        expectTypeOf(deleteHandler.requests[0].pathParams).toEqualTypeOf<{ userId: string }>();
        expect(deleteHandler.requests[0].pathParams).toEqual({ userId: user.id });

        expectTypeOf(deleteHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(deleteHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(deleteHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(deleteHandler.requests[0].body).toEqualTypeOf<null>();
        expect(deleteHandler.requests[0].body).toBe(null);

        expectTypeOf(deleteHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(deleteHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(deleteHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
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
      readAt: null,
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

        expectTypeOf(listHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(listHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await listHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(listHandler.requests[0].response.body).toEqualTypeOf<Notification[]>();
        expect(listHandler.requests[0].response.body).toEqual([notification]);

        expectTypeOf(listHandler.requests[0].response.raw).toEqualTypeOf<
          HttpResponse<Notification[], { 'content-type': 'application/json' }, 200>
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

    describe('Notification reading', () => {
      async function markNotificationAsRead(notificationId: string) {
        const request = new Request(`${notificationBaseURL}/notifications/${encodeURIComponent(notificationId)}/read`, {
          method: 'POST',
        });
        return fetch(request);
      }

      async function markNotificationAsUnread(notificationId: string) {
        const request = new Request(
          `${notificationBaseURL}/notifications/${encodeURIComponent(notificationId)}/unread`,
          {
            method: 'POST',
          },
        );
        return fetch(request);
      }

      it('should support marking notifications as read', async () => {
        const markAsReadHandler = await notificationInterceptor
          .post('/notifications/:notificationId/read')
          .respond({ status: 204 })
          .times(1);

        const response = await markNotificationAsRead(notification.id);
        expect(response.status).toBe(204);

        expect(markAsReadHandler.requests).toHaveLength(1);
        expect(markAsReadHandler.requests[0].url).toBe(`${notificationBaseURL}/notifications/${notification.id}/read`);

        expectTypeOf(markAsReadHandler.requests[0].pathParams).toEqualTypeOf<{ notificationId: string }>();
        expect(markAsReadHandler.requests[0].pathParams).toEqual({ notificationId: notification.id });

        expectTypeOf(markAsReadHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(markAsReadHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(markAsReadHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(markAsReadHandler.requests[0].body).toEqualTypeOf<null>();
        expect(markAsReadHandler.requests[0].body).toBe(null);

        expectTypeOf(markAsReadHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(markAsReadHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(markAsReadHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await markAsReadHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(markAsReadHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(markAsReadHandler.requests[0].response.body).toBe(null);

        expectTypeOf(markAsReadHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<null, never, 204>>();
        expect(markAsReadHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(markAsReadHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await markAsReadHandler.requests[0].response.raw.text()).toBe('');
      });

      it('should support marking notifications as unread', async () => {
        const markAsUnreadHandler = await notificationInterceptor
          .post('/notifications/:notificationId/unread')
          .respond({ status: 204 })
          .times(1);

        const response = await markNotificationAsUnread(notification.id);
        expect(response.status).toBe(204);

        expect(markAsUnreadHandler.requests).toHaveLength(1);
        expect(markAsUnreadHandler.requests[0].url).toBe(
          `${notificationBaseURL}/notifications/${notification.id}/unread`,
        );

        expectTypeOf(markAsUnreadHandler.requests[0].pathParams).toEqualTypeOf<{ notificationId: string }>();
        expect(markAsUnreadHandler.requests[0].pathParams).toEqual({ notificationId: notification.id });

        expectTypeOf(markAsUnreadHandler.requests[0].headers).toEqualTypeOf<HttpHeaders<never>>();

        expectTypeOf(markAsUnreadHandler.requests[0].searchParams).toEqualTypeOf<HttpSearchParams<never>>();
        expect(markAsUnreadHandler.requests[0].searchParams.size).toBe(0);

        expectTypeOf(markAsUnreadHandler.requests[0].body).toEqualTypeOf<null>();
        expect(markAsUnreadHandler.requests[0].body).toBe(null);

        expectTypeOf(markAsUnreadHandler.requests[0].raw).toEqualTypeOf<HttpRequest<null, never>>();
        expect(markAsUnreadHandler.requests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(markAsUnreadHandler.requests[0].raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await markAsUnreadHandler.requests[0].raw.text()).toBe('');

        expectTypeOf(markAsUnreadHandler.requests[0].response.body).toEqualTypeOf<null>();
        expect(markAsUnreadHandler.requests[0].response.body).toBe(null);

        expectTypeOf(markAsUnreadHandler.requests[0].response.raw).toEqualTypeOf<HttpResponse<null, never, 204>>();
        expect(markAsUnreadHandler.requests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(markAsUnreadHandler.requests[0].response.raw.json).toEqualTypeOf<() => Promise<never>>();
        expect(await markAsUnreadHandler.requests[0].response.raw.text()).toBe('');
      });
    });
  });
}
