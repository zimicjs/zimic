import createFetch from '@/fetch/factory';
import { FetchInput } from '@/fetch/types/public';
import { FetchRequest, FetchRequestInit } from '@/fetch/types/requests';
import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http';
import { ConvertToStrictHttpSchema } from '@/http/types/schema';
import { httpInterceptor } from '@/interceptor/http';
import { Default } from '@/types/utils';
import { expectTypeOf } from 'vitest';

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
      // response: {
      //   201: { body: User };
      //   // 401: { body: { code: 'UNAUTHORIZED'; message: string } };
      //   // 403: { body: { code: 'FORBIDDEN'; message: string } };
      //   // 409: { body: { code: 'CONFLICT'; message: string } };
      //   // 500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
      // };
    };

    // GET: {
    //   request: {
    //     searchParams?: { username?: string };
    //   };
    //   response: {
    //     200: { body: User[] };
    //     401: { body: { code: 'UNAUTHORIZED'; message: string } };
    //     403: { body: { code: 'FORBIDDEN'; message: string } };
    //     500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
    //   };
    // };
  };

  // '/users/:id': {
  //   GET: {
  //     response: {
  //       200: { body: User };
  //       401: { body: { code: 'UNAUTHORIZED'; message: string } };
  //       403: { body: { code: 'FORBIDDEN'; message: string } };
  //       404: { body: { code: 'NOT_FOUND'; message: string } };
  //       500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
  //     };
  //   };
  // };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

function tmp(something: unknown): something is 'something' {
  return something === 'something';
}

const data = '123' as unknown;

if (tmp(data)) {
  data;
} else {
  data;
}

async function wrappedFetch<Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
  input: FetchInput<Schema, Path, Method>,
  init?: FetchRequestInit<Schema, Path, Method>,
) {
  const request = new fetch.Request(input, init);

  if (request.method === 'POST' && request.path === '/users') {
    request;
  }

  if (fetch.isRequest(request, '/users', 'POST')) {
    request;

    expectTypeOf(request).toEqualTypeOf<FetchRequest<'/users', 'POST', Default<Schema['/users']['POST']>>>();

    // const other = fetch.isRequest(request, '/users', 'POST');
    const other: FetchRequest<'/users', 'POST', Default<Schema['/users']['POST']>> = request;

    type A = FetchRequest<'/users', 'POST', ConvertToStrictHttpSchema<Schema>['/users']['POST']>;
    type B = A['json'];
    type C = typeof request;

    request.headers.get('content-type');

    const data = await request.json();
    console.log(data.username);

    const data2 = await other.json();
    console.log(data2.username);
  }

  const response = await fetch(input, init);

  if (!response.ok) {
    throw response.error();
  }

  return response;
}

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: fetch.baseURL(),
});

async function createUser(payload: UserCreationPayload) {
  const response = await wrappedFetch('/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

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
