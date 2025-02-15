import { describe, it } from 'vitest';

import { HttpSchema } from '@/http';
import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';

describe('FetchClient (node) > Bodies', () => {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  it('should show a type error if trying to use a non-assignable request body', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            body: { name?: string };
          };
          response: {
            204: {};
          };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ type: 'local', baseURL }, async (interceptor) => {
      interceptor.post('/users').respond({ status: 204 });

      const fetch = createFetch<Schema>({ baseURL });

      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'User 1' }),
      });

      await fetch('/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // @ts-expect-error Forcing an invalid request body
      await fetch('/users', {
        method: 'POST',
        body: 'invalid',
      });
    });
  });

  it('should not allow declaring request bodies for methods that do not support them', () => {
    // @ts-expect-error GET methods do not support request bodies
    createFetch<{ '/users': { GET: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { request: {} } } }>({ baseURL });

    // @ts-expect-error HEAD methods do not support request bodies
    createFetch<{ '/users': { HEAD: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { request: {} } } }>({ baseURL });

    // @ts-expect-error OPTIONS methods do not support request bodies
    createFetch<{ '/users': { OPTIONS: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { POST: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { PUT: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { PATCH: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { request: {} } } }>({ baseURL });

    createFetch<{ '/users': { DELETE: { request: { body: User } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: { body: null } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: { body: undefined } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { request: {} } } }>({ baseURL });
  });

  it('should not allow declaring response bodies for methods or statuses that do not support them', () => {
    // @ts-expect-error HEAD methods do not support request bodies
    createFetch<{ '/users': { HEAD: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { HEAD: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { HEAD: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { GET: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { GET: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { GET: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { POST: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { POST: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { POST: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { PUT: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { PUT: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PUT: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { PATCH: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { PATCH: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { PATCH: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { DELETE: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { DELETE: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { DELETE: { response: { 204: {} } } } }>({ baseURL });

    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 200: {} } } } }>({ baseURL });
    // @ts-expect-error 204 responses do not support request bodies
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: User } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: null } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: { body: undefined } } } } }>({ baseURL });
    createFetch<{ '/users': { OPTIONS: { response: { 204: {} } } } }>({ baseURL });
  });
});
