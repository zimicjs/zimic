import createFetch from '@/fetch/factory';
import { HttpSchema } from '@/http';
import { httpInterceptor } from '@/interceptor/http';

interface User {
  id: string;
  username: string;
}

type UserCreationPayload = Omit<User, 'id'>;

type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
        body: UserCreationPayload;
      };
      response: {
        201: { body: User };
        401: { body: { code: 'UNAUTHORIZED'; message: string } };
        403: { body: { code: 'FORBIDDEN'; message: string } };
        409: { body: { code: 'CONFLICT'; message: string } };
        500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
      };
    };

    GET: {
      request: {
        searchParams?: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { code: 'UNAUTHORIZED'; message: string } };
        403: { body: { code: 'FORBIDDEN'; message: string } };
        500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
      };
    };
  };

  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
        401: { body: { code: 'UNAUTHORIZED'; message: string } };
        403: { body: { code: 'FORBIDDEN'; message: string } };
        404: { body: { code: 'NOT_FOUND'; message: string } };
        500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: fetch.baseURL(),
});

async function createUser(payload: UserCreationPayload) {
  const response = await fetch('/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw response.error();
  }

  const user = await response.json();
  return user;
}

async function main() {
  await interceptor.start();

  interceptor
    .post('/users')
    .with({ body: { username: 'user' } })
    // .respond({
    //   status: 409,
    //   body: { code: 'CONFLICT', message: 'Username already exists' },
    // })
    .respond((request) => {
      const user: User = {
        id: crypto.randomUUID(),
        username: request.body.username,
      };

      return { status: 201, body: user };
    });

  try {
    const user = await createUser({ username: 'user' });
    console.log(user);
  } catch (error) {
    if (fetch.isResponseError(error, '/users', 'POST')) {
      const errorBody = await error.response.json();
      console.log(errorBody);
    } else {
      console.error(error);
    }
  } finally {
    await interceptor.stop();
  }
}

void main();
