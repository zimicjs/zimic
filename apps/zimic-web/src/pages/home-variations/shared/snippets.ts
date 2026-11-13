export const install = 'npm install @zimic/http @zimic/fetch @zimic/interceptor';

export const schema = `
import { HttpSchema } from '@zimic/http';

interface User {
  username: string;
}

interface RequestError {
  code: string;
  message: string;
}

export type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: User };
      response: {
        201: { body: User };
        409: { body: RequestError };
      };
    };

    GET: {
      request: { searchParams: { query?: string } };
      response: { 200: { body: User[] } };
    };
  };
}>;
`;

export const typegen = `
zimic-http typegen openapi ./openapi.yaml \\
  --output ./schema.ts \\
  --service-name MyService
`;

export const fetch = `
import { createFetch } from '@zimic/fetch';

import { Schema } from './schema';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

if (response.status === 409) {
  // highlight-next-line
  const error = await response.json(); // RequestError
  throw new Error(error.message);
}

if (!response.ok) {
  throw response.error;
}

// highlight-next-line
const user = await response.json(); // User
`;

export const interceptor = `
import { createHttpInterceptor } from '@zimic/interceptor/http';

import { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
});

beforeAll(() => interceptor.start());
beforeEach(() => interceptor.clear());
afterEach(() => interceptor.checkTimes());
afterAll(() => interceptor.stop());

test('searches users', async () => {
  // highlight-start
  interceptor
    .get('/users')
    .with({ searchParams: { query: 'u' } })
    .respond({ status: 200, body: [{ username: 'me' }] })
    .times(1);
  // highlight-end

  const users = await searchUsers('u');
  expect(users).toHaveLength(1);
});
`;

// Follows the path-keyed schema of https://github.com/zimicjs/zimic/pull/1463. Update if that API changes.
export const webSocket = `
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

type Schema = WebSocketSchema<{
  '/chat': {
    message: { type: 'message'; data: { text: string } };
  };
}>;

const client = new WebSocketClient<Schema>('ws://localhost:3000/chat');
await client.open();

client.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log(message.data.text);
});

client.send(JSON.stringify({ type: 'message', data: { text: 'Hello!' } }));
`;

export const typeErrorHero = `
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  // error-next-line
  body: JSON.stringify({ name: 'me' }),
  // Type error: 'name' does not exist in User
});

if (response.status === 201) {
  // highlight-next-line
  const user = await response.json(); // User
}

if (response.status === 409) {
  // highlight-next-line
  const error = await response.json(); // RequestError
}
`;

export const typeErrorPath = `
// error-next-line
await fetch('/user', { method: 'GET' });
// Type error: unknown path '/user'
`;

export const typeErrorParams = `
await fetch('/users', {
  method: 'GET',
  // error-next-line
  searchParams: { search: 'u' },
  // Type error: unknown param 'search'
});
`;

export const typeErrorMock = `
interceptor.get('/users').respond({
  status: 200,
  // error-next-line
  body: { username: 'me' },
  // Type error: expected User[]
});
`;

export const plainFetch = `
const url = new URL('/users', 'http://localhost:3000');
url.searchParams.set('query', 'u');

const response = await fetch(url);

// Nothing checks the path, the params, or this cast
const users = (await response.json()) as User[];
`;

export const zimicFetch = `
const response = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'u' },
});

// Inferred from the schema as User[]
const users = await response.json();
`;

export const plainMock = `
vi.spyOn(globalThis, 'fetch').mockResolvedValue(
  // The API returns \`username\`, but this test passes
  Response.json([{ name: 'me' }]),
);

const users = await searchUsers('u');
expect(users).toHaveLength(1);

// The query the application sent is never checked
expect(fetch).toHaveBeenCalledTimes(1);
`;

export const zimicMock = `
interceptor
  .get('/users')
  .with({ searchParams: { query: 'u' } })
  // The compiler checks the body against the schema
  .respond({ status: 200, body: [{ username: 'me' }] })
  .times(1);

const users = await searchUsers('u');
expect(users).toHaveLength(1);

// afterEach: interceptor.checkTimes() fails the test
// if the request was not made once with that query
`;
