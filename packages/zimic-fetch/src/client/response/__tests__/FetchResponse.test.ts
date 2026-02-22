import { HttpSchema } from '@zimic/http';
import { describe, it } from 'vitest';

import createFetch from '@/client/factory';
import { FetchRequest } from '@/client/request/FetchRequest';

import { FetchResponse } from '../FetchResponse';

describe('FetchResponse', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support making creating FetchResponse objects directly', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { body: User };
          response: { 201: { body: User } };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    const response = new FetchResponse(request, JSON.stringify(users[0]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });

    response satisfies FetchResponse<Schema, 'POST', '/users', false, 'follow', 201>;
  });

  it('should support making creating FetchResponse objects as a result of a FetchRequest', async () => {});

  it('should be an instance of Response', async () => {});

  it('should implement all properties and methods from Response', async () => {});

  it('should allow accessing the raw Response object', async () => {});

  it('should allow accessing the FetchRequest object that generated the response', async () => {});

  it('should correctly generate a new FetchResponse clone', async () => {});

  it('should correctly generated a FetchResponseObject', async () => {});
});
