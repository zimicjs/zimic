import { beforeAll, beforeEach, afterAll, expect, describe, it, expectTypeOf } from 'vitest';

import { ClientTestDeclarationOptions } from '.';

function declareDefaultClientTests(options: ClientTestDeclarationOptions) {
  const { createInterceptor, fetch } = options;

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

  const authInterceptor = createInterceptor<{
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
  }>({
    baseURL: 'https://localhost:3000',
  });

  describe('Users', () => {
    const user: User = {
      id: crypto.randomUUID(),
      name: 'Name',
      email: 'email@email.com',
    };

    beforeAll(async () => {
      await authInterceptor.start();
    });

    beforeEach(() => {
      authInterceptor.clearHandlers();
    });

    afterAll(() => {
      authInterceptor.stop();
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
      });

      it('should return an error if the payload is not valid', async () => {
        // @ts-expect-error Forcing an invalid payload
        const invalidPayload: UserCreationPayload = {};

        const creationTracker = authInterceptor.post('/users').respond({
          status: 400,
          body: {
            code: 'validation_error',
            message: 'Invalid payload',
          },
        });

        const response = await createUser(invalidPayload);
        expect(response.status).toBe(400);

        const creationRequests = creationTracker.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(invalidPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<ValidationError>();
      });

      it('should return an error if the payload is not valid', async () => {
        const conflictingPayload: UserCreationPayload = creationPayload;

        const creationTracker = authInterceptor.post('/users').respond({
          status: 409,
          body: {
            code: 'conflict',
            message: 'User already exists',
          },
        });

        const response = await createUser(conflictingPayload);
        expect(response.status).toBe(409);

        const creationRequests = creationTracker.requests();
        expect(creationRequests).toHaveLength(1);

        expectTypeOf(creationRequests[0].body).toEqualTypeOf<UserCreationPayload>();
        expect(creationRequests[0].body).toEqual(conflictingPayload);

        expectTypeOf(creationRequests[0].response.body).toEqualTypeOf<ConflictError>();
      });
    });

    describe('User list', () => {
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

        const response = await listUsers();
        expect(response.status).toBe(200);

        const returnedUsers = (await response.json()) as User[];
        expect(returnedUsers).toEqual([user]);

        const listRequests = listTracker.requests();
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
      });

      it('should return an error if the user was not found', async () => {
        const getTracker = authInterceptor.get('/users/:id').respond({
          status: 404,
          body: {
            code: 'not_found',
            message: 'User not found',
          },
        });

        const response = await getUserById(user.id);
        expect(response.status).toBe(404);

        const getRequests = getTracker.requests();
        expect(getRequests).toHaveLength(1);
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
      });

      it('should return an error if the user was not found', async () => {
        const getTracker = authInterceptor.delete<'/users/:id'>(`/users/${user.id}`).respond({
          status: 404,
          body: {
            code: 'not_found',
            message: 'User not found',
          },
        });

        const response = await deleteUserById(user.id);
        expect(response.status).toBe(404);

        const getRequests = getTracker.requests();
        expect(getRequests).toHaveLength(1);
      });
    });
  });
}

export default declareDefaultClientTests;
