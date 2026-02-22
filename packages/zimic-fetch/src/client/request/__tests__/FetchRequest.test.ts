import { HttpSchema } from '@zimic/http';
import { describe, expect, expectTypeOf, it } from 'vitest';

import createFetch from '@/client/factory';

import { FetchRequest } from '../FetchRequest';

describe('FetchRequest', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support making creating FetchRequest objects directly', async () => {
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

    expectTypeOf(request satisfies Request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();

    expect(request.arrayBuffer()).toBe();
    expect(request.blob()).toBe();
    expect(request.body).toBe();
    expect(request.bodyUsed).toBe();
    expect(request.bytes()).toBe();
    expect(request.cache).toBe();
    expect(request.clone()).toBe();
    expect(request.credentials).toBe();
    expect(request.destination).toBe();
    expect(request.duplex).toBe();
    expect(request.formData()).toBe();
    expect(request.headers).toBe();
    expect(request.integrity).toBe();
    expect(request.json()).toBe();
    expect(request.keepalive).toBe();
    expect(request.method).toBe();
    expect(request.mode).toBe();
    expect(request.path).toBe();
    expect(request.raw).toBe();
    expect(request.redirect).toBe();
    expect(request.referrer).toBe();
    expect(request.referrerPolicy).toBe();
    expect(request.signal).toBe();
    expect(request.targetAddressSpace).toBe();
    expect(request.text()).toBe();
    expect(request.toObject()).toBe();
    expect(request.url).toBe();
  });

  it('should support making creating FetchRequest objects from a fetch instance', async () => {});

  it('should be an instance of Request', async () => {});

  it('should implement all properties and methods from Request', async () => {});

  it('should allow accessing the raw Request object', async () => {});

  it('should correctly generate a new FetchRequest clone', async () => {});

  it('should correctly generated a FetchRequestObject', async () => {});
});
