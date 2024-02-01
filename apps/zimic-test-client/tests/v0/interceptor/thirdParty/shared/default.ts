import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf } from 'vitest';
import {
  HttpInterceptorSchema,
  HttpRequest,
  HttpResponse,
  createHttpInterceptor,
  createHttpInterceptorWorker,
} from 'zimic0/interceptor';

import { getCrypto } from '@tests/utils/crypto';

import { ClientTestDeclarationOptions } from '.';

function declareDefaultClientTests(options: ClientTestDeclarationOptions) {
  const { platform, fetch } = options;

  interface User {
    id: string;
    name: string;
    email: string;
  }

  interface UserWithPassword extends User {
    password: string;
  }

  type UserCreationPayload = Omit<UserWithPassword, 'id'>;

  interface LoginResult {
    accessToken: string;
    refreshToken: string;
  }

  interface RequestError {
    code: string;
    message: string;
  }

  interface ValidationError extends RequestError {
    code: 'validation_error';
  }

  interface UnauthorizedError extends RequestError {
    code: 'unauthorized';
  }

  interface NotFoundError extends RequestError {
    code: 'not_found';
  }

  interface ConflictError extends RequestError {
    code: 'conflict';
  }

  type UsersRootSchema = HttpInterceptorSchema.Root<{
    '/users': {
      POST: {
        request: {
          body: UserCreationPayload;
        };
        response: {
          201: { body: User };
          400: { body: ValidationError };
          409: { body: ConflictError };
        };
      };
      GET: {
        response: {
          200: { body: User[] };
        };
      };
    };
  }>;

  type UserByIdRootSchema = HttpInterceptorSchema.Root<{
    '/users/:id': {
      GET: {
        response: {
          200: { body: User };
          404: { body: NotFoundError };
        };
      };
      PATCH: {
        request: {
          body: Partial<User>;
        };
        response: {
          200: { body: User };
          404: { body: NotFoundError };
        };
      };
      DELETE: {
        response: {
          204: {};
          404: { body: NotFoundError };
        };
      };
    };
  }>;

  type SessionRootSchema = HttpInterceptorSchema.Root<{
    '/session/login': {
      POST: {
        request: {
          body: {
            email: string;
            password: string;
          };
        };
        response: {
          201: { body: LoginResult };
          400: { body: ValidationError };
          401: { body: UnauthorizedError };
        };
      };
    };

    '/session/refresh': {
      POST: {
        request: {
          body: { refreshToken: string };
        };
        response: {
          201: { body: LoginResult };
          401: { body: UnauthorizedError };
        };
      };
    };

    '/session/logout': {
      POST: {
        response: {
          204: { body: undefined };
          401: { body: UnauthorizedError };
        };
      };
    };
  }>;

  type AuthRootSchema = HttpInterceptorSchema.Root<UsersRootSchema & UserByIdRootSchema & SessionRootSchema>;

  const worker = createHttpInterceptorWorker({
    platform,
    baseURL: 'https://localhost:3000',
  });

  const authInterceptor = createHttpInterceptor<AuthRootSchema>({ worker });

  describe('Users', async () => {
    const crypto = await getCrypto();

    const user: User = {
      id: crypto.randomUUID(),
      name: 'Name',
      email: 'email@email.com',
    };

    beforeAll(async () => {
      await worker.start();
    });

    beforeEach(() => {
      authInterceptor.clear();
    });

    afterAll(async () => {
      await worker.stop();
    });

    describe('User creation', () => {
      const creationPayload: UserCreationPayload = {
        name: user.name,
        email: user.email,
        password: 'password',
      };

      async function createUser(payload: UserCreationPayload) {
        const request = new Request('https://localhost:3000/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return fetch(request);
      }

      it('should support creating users', async () => {
        const creationTracker = authInterceptor.post('/users').respond((request) => ({
          status: 201,
          body: {
            id: crypto.randomUUID(),
            name: request.body.name,
            email: request.body.email,
          },
        }));

        const response = await createUser(creationPayload);
        expect(response.status).toBe(201);

        const createdUser = (await response.json()) as User;
        expect(createdUser).toEqual<User>({
          id: expect.any(String) as string,
          name: creationPayload.name,
          email: creationPayload.email,
        });

        const creationRequests = creationTracker.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(creationPayload);

        expectTypeOf(creationRequests[0].raw).toEqualTypeOf<HttpRequest<UserCreationPayload>>();
        expect(creationRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(creationRequests[0].raw.json).toEqualTypeOf<() => Promise<UserCreationPayload>>();
        expect(await creationRequests[0].raw.json()).toEqual(creationPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<User>();
        expect(creationRequests[0].response.body).toEqual(createdUser);

        expectTypeOf(creationRequests[0].response.raw).toEqualTypeOf<HttpResponse<User, 201>>();
        expect(creationRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(creationRequests[0].response.raw.json).toEqualTypeOf<() => Promise<User>>();
        expect(await creationRequests[0].response.raw.json()).toEqual(createdUser);
      });

      it('should return an error if the payload is not valid', async () => {
        // @ts-expect-error Forcing an invalid payload
        const invalidPayload: UserCreationPayload = {};

        const validationError: ValidationError = {
          code: 'validation_error',
          message: 'Invalid payload',
        };
        const creationTracker = authInterceptor.post('/users').respond({
          status: 400,
          body: validationError,
        });

        const response = await createUser(invalidPayload);
        expect(response.status).toBe(400);

        const creationRequests = creationTracker.requests();
        expect(creationRequests).toHaveLength(1);

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
        const creationTracker = authInterceptor.post('/users').respond({
          status: 409,
          body: conflictError,
        });

        const response = await createUser(conflictingPayload);
        expect(response.status).toBe(409);

        const creationRequests = creationTracker.requests();
        expect(creationRequests).toHaveLength(1);

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
      beforeEach(() => {
        authInterceptor.get('/users').respond({
          status: 200,
          body: [],
        });
      });

      async function listUsers(filters: { name?: string; email?: string } = {}) {
        const searchParams = new URLSearchParams(filters);
        const request = new Request(`https://localhost:3000/users?${searchParams}`, { method: 'GET' });
        return fetch(request);
      }

      it('should list users', async () => {
        const listTracker = authInterceptor.get('/users').respond({
          status: 200,
          body: [user],
        });

        let response = await listUsers();
        expect(response.status).toBe(200);

        let returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual([user]);

        const listRequests = listTracker.requests();
        expect(listRequests).toHaveLength(1);

        expectTypeOf(listRequests[0].body).toEqualTypeOf<null>();
        expect(listRequests[0].body).toBe(null);

        expectTypeOf(listRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(listRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(listRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await listRequests[0].raw.text()).toBe('');

        expectTypeOf(listRequests[0].response.body).toEqualTypeOf<User[]>();
        expect(listRequests[0].response.body).toEqual([user]);

        expectTypeOf(listRequests[0].response.raw).toEqualTypeOf<HttpResponse<User[], 200>>();
        expect(listRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(listRequests[0].response.raw.json).toEqualTypeOf<() => Promise<User[]>>();
        expect(await listRequests[0].response.raw.json()).toEqual([user]);

        listTracker.bypass();

        response = await listUsers();
        expect(response.status).toBe(200);

        returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual([]);

        expect(listRequests).toHaveLength(1);
      });
    });

    describe('User get by id', () => {
      async function getUserById(userId: string) {
        const request = new Request(`https://localhost:3000/users/${userId}`, { method: 'GET' });
        return fetch(request);
      }

      it('should support getting users by id', async () => {
        const getTracker = authInterceptor.get<'/users/:id'>(`/users/${user.id}`).respond({
          status: 200,
          body: user,
        });

        const response = await getUserById(user.id);
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual(user);

        const getRequests = getTracker.requests();
        expect(getRequests).toHaveLength(1);

        expectTypeOf(getRequests[0].body).toEqualTypeOf<null>();
        expect(getRequests[0].body).toBe(null);

        expectTypeOf(getRequests[0].raw).toEqualTypeOf<HttpRequest<null>>();
        expect(getRequests[0].raw).toBeInstanceOf(Request);
        expectTypeOf(getRequests[0].raw.json).toEqualTypeOf<() => Promise<null>>();
        expect(await getRequests[0].raw.text()).toBe('');

        expectTypeOf(getRequests[0].response.body).toEqualTypeOf<User>();
        expect(getRequests[0].response.body).toEqual(user);

        expectTypeOf(getRequests[0].response.raw).toEqualTypeOf<HttpResponse<User, 200>>();
        expect(getRequests[0].response.raw).toBeInstanceOf(Response);
        expectTypeOf(getRequests[0].response.raw.json).toEqualTypeOf<() => Promise<User>>();
        expect(await getRequests[0].response.raw.json()).toEqual(user);
      });

      it('should return an error if the user was not found', async () => {
        const notFoundError: NotFoundError = {
          code: 'not_found',
          message: 'User not found',
        };
        const getTracker = authInterceptor.get('/users/:id').respond({
          status: 404,
          body: notFoundError,
        });

        const response = await getUserById(user.id);
        expect(response.status).toBe(404);

        const getRequests = getTracker.requests();
        expect(getRequests).toHaveLength(1);

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
        const request = new Request(`https://localhost:3000/users/${userId}`, { method: 'DELETE' });
        return fetch(request);
      }

      it('should support deleting users by id', async () => {
        const deleteTracker = authInterceptor.delete<'/users/:id'>(`/users/${user.id}`).respond({
          status: 204,
        });

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(204);

        const deleteRequests = deleteTracker.requests();
        expect(deleteRequests).toHaveLength(1);

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
        const getTracker = authInterceptor.delete<'/users/:id'>(`/users/${user.id}`).respond({
          status: 404,
          body: notFoundError,
        });

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(404);

        const deleteRequests = getTracker.requests();
        expect(deleteRequests).toHaveLength(1);

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
}

export default declareDefaultClientTests;
