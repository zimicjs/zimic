import createFetch from '@/fetch/factory';
import { HttpSearchParams } from '@/http';

interface User {
  id: string;
  username: string;
  name: string;
}

const { fetch } = createFetch<{
  '/api/users': {
    GET: {
      request: {
        searchParams?: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };

    POST: {
      request: {
        body: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
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
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
  throwOnError: false,
});

async function main() {
  const searchParams = new HttpSearchParams({ username: '1' });

  await fetch('/api/users', {
    method: 'GET',
    body: null,
  });

  await fetch('/api/users', {
    method: 'GET',
    body: null,
  });

  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });

  const response = await fetch('/api/users/others', {
    method: 'GET',
    searchParams: { username: 'john' },
    headers: { authorization: 'Bearer token' },
  });

  if (response.status === 200) {
    const data = await response.json();
  }

  // @ts-expect-error
  await fetch('/api/users/others', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });
}

void main();
