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

export const httpInterceptor = `
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

// The WebSocket snippets follow the path-keyed schema of https://github.com/zimicjs/zimic/pull/1463 and the
// interceptor docs of https://github.com/zimicjs/zimic/pull/1343. Check them against the final API before release.
export const webSocket = `
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

export type Schema = WebSocketSchema<{
  '/chat': {
    message:
      | { type: 'message'; data: { text: string } }
      | { type: 'typing'; data: { username: string } };
  };
}>;

const client = new WebSocketClient<Schema>('ws://localhost:3000/chat');
await client.open();

client.addEventListener('message', (event) => {
  // highlight-next-line
  const message = JSON.parse(event.data); // typed by the schema
  console.log(message.type);
});

client.send(
  JSON.stringify({ type: 'message', data: { text: 'Hello!' } }),
);
`;

export const webSocketInterceptor = `
import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

import { Schema } from './schema';

const interceptor = createWebSocketInterceptor<Schema>({
  baseURL: 'ws://localhost:3000',
});

beforeAll(() => interceptor.start());
beforeEach(() => interceptor.clear());
afterEach(() => interceptor.checkTimes());
afterAll(() => interceptor.stop());

test('shows who is typing', async () => {
  // highlight-start
  interceptor
    .message('/chat')
    .with({ type: 'message' })
    .respond({ type: 'typing', data: { username: 'bot' } })
    .times(1);
  // highlight-end

  await sendChatMessage('Hello!');
  expect(await findTypingUsername()).toBe('bot');
});
`;
