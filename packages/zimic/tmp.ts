import createFetchClient from '@/fetch/factory';
import FetchRequestError from '@/fetch/FetchRequestError';
import { HttpSchema, HttpSearchParams } from '@/http';

interface User {
  id: string;
  username: string;
  name: string;
}

type Schema = HttpSchema<{
  '/api/users': {
    GET: {
      request: {
        searchParams?: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: 401; path: '/api/users' } };
        403: { body: { message?: 403; path: '/api/users' } };
        500: { body: { message?: 500; path: '/api/users' } };
      };
    };

    POST: {
      request: {
        body: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: 401; path: '/api/users' } };
        403: { body: { message?: 403; path: '/api/users' } };
        500: { body: { message?: 500; path: '/api/users' } };
      };
    };
  };

  '/api/users/others': {
    GET: {
      request: {
        headers: { authorization: string };
        searchParams: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: 401; path: '/api/users/others' } };
      };
    };
  };
}>;

const client = createFetchClient<Schema>({
  baseURL: 'http://localhost:3000',
});

async function main() {
  const searchParams = new HttpSearchParams({ username: '1' });

  await client.fetch('/api/users', {
    method: 'GET',
    body: null,
  });

  await client.fetch('/api/users', {
    method: 'GET',
    body: null,
  });

  await client.fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });

  const response = await client.fetch('/api/users/others', {
    method: 'GET',
    searchParams: { username: 'john' },
    headers: { authorization: 'Bearer token' },
  });

  if (!response.ok) {
    throw response.error();
  }

  const data = await response.json();

  try {
  } catch (error) {
    if (client.isRequestError(error, '/api/users/others', 'GET')) {
      const errorData = await error.response.json();
    }
  }

  // @ts-expect-error
  await client.fetch('/api/users/others', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });
}

void main();
