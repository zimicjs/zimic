import { HttpSchema, JSONValue, StrictHeaders } from '@zimic/http';
import { joinURL } from '@zimic/utils/url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { isClientSide } from '@/utils/environment';
import { usingIgnoredConsole } from '@tests/utils/console';

import createFetch from '../../factory';
import FetchResponseError from '../error/FetchResponseError';
import { FetchResponse } from '../FetchResponse';
import { FetchResponseObject } from '../types';

describe('FetchResponse', () => {
  const baseURL = 'http://localhost:3000';

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support making creating FetchResponse objects directly', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    const response = new FetchResponse<Schema, 'POST', '/users'>(request, JSON.stringify(users[0]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response.status).toEqualTypeOf<201>();
    expectTypeOf(response.raw).toEqualTypeOf<Response>();
    expectTypeOf(response.request).toEqualTypeOf<typeof request>();
    expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'POST', '/users'>>();
    expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    expectTypeOf(response.body).toEqualTypeOf<ReadableStream<Uint8Array<ArrayBuffer>> | null>();
    expectTypeOf(response.bodyUsed).toEqualTypeOf<boolean>();
    expectTypeOf(response.ok).toEqualTypeOf<true>();
    expectTypeOf(response.clone).toEqualTypeOf<() => typeof response>();
    expectTypeOf(response.json).toEqualTypeOf<() => Promise<User>>();
    expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
    expectTypeOf(response.formData).toEqualTypeOf<() => Promise<FormData>>();
    expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
    expectTypeOf(response.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    expect(response.status).toBe(201);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual(users[0]);
  });

  it('should support making creating FetchResponse objects as a result of a FetchRequest', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'application/json' };
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const rawResponse = new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, rawResponse);

    expect(response).toBeInstanceOf(FetchResponse);
    expectTypeOf(response.request.method).toEqualTypeOf<'GET'>();
    expectTypeOf(response.request.path).toEqualTypeOf<'/users'>();
    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();

    expect(response.request).toBe(request);
    expect(response.request.path).toBe('/users');
    expect(response.request.url).toBe(joinURL(baseURL, '/users'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(users);
  });

  it('should be an instance of Response', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'application/json' };
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response).toBeInstanceOf(FetchResponse);
    expect(response).toBeInstanceOf(Response);
  });

  it('should implement all properties and methods from Response', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'application/json' };
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    for (const property of Reflect.ownKeys(Response.prototype)) {
      if (property === 'constructor') {
        continue;
      }

      expect(property in response).toBe(true);
    }

    const textFromDetachedMethod = response.clone().text;
    expect(await textFromDetachedMethod()).toBe(JSON.stringify(users));

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.ok).toBe(true);
    expect(response.bodyUsed).toBe(false);
  });

  it('should allow accessing the raw Response object', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const rawResponse = new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, rawResponse);

    expect(response.raw).toBeInstanceOf(Response);
    expect(response.raw).not.toBe(response);
    expect(response.raw).toBe(rawResponse);
  });

  it('should allow accessing the FetchRequest object that generated the response', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'application/json' };
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.request).toBe(request);
    expect(response.request.path).toBe('/users');
    expect(response.request.method).toBe('GET');
  });

  it('should correctly generate a new FetchResponse clone', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: {
              headers: { 'content-type': 'application/json' };
              body: User[];
            };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const clone = response.clone();

    expect(clone).toBeInstanceOf(FetchResponse);
    expect(clone).not.toBe(response);
    expect(clone.raw).not.toBe(response.raw);

    expectTypeOf(clone).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();
    expectTypeOf(clone.clone).toEqualTypeOf<() => typeof clone>();
    expectTypeOf(clone.status).toEqualTypeOf<200>();
    expectTypeOf(clone.request).toEqualTypeOf<typeof request>();
    expectTypeOf(clone.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();
    expectTypeOf(clone.json).toEqualTypeOf<() => Promise<User[]>>();
    expectTypeOf(clone.text).toEqualTypeOf<() => Promise<string>>();
    expectTypeOf(clone.formData).toEqualTypeOf<() => Promise<FormData>>();
    expectTypeOf(clone.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
    expectTypeOf(clone.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    expect(clone.status).toBe(response.status);
    expect(clone.url).toBe(response.url);
    expect(clone.request).toBe(response.request);
    expect(await clone.json()).toEqual(users);

    expect(response.bodyUsed).toBe(false);
    expect(await response.json()).toEqual(users);
  });

  describe('toObject', () => {
    it.each([{ includeBody: undefined }, { includeBody: false as const }])(
      'should correctly generated a FetchResponseObject (%o)',
      ({ includeBody }) => {
        type Schema = HttpSchema<{
          '/users': {
            GET: {
              response: {
                200: {
                  headers: { 'content-type': 'application/json' };
                  body: User[];
                };
              };
            };
          };
        }>;

        const fetch = createFetch<Schema>({ baseURL });

        const request = new fetch.Request('/users', {
          method: 'GET',
        });

        const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const responseObject = response.toObject({ includeBody });
        expectTypeOf(responseObject).toEqualTypeOf<FetchResponseObject>();

        expect(responseObject).toEqual<FetchResponseObject>({
          url: '',
          type: isClientSide() ? 'default' : 'default',
          status: 200,
          statusText: '',
          ok: true,
          headers: { 'content-type': 'application/json' },
          redirected: false,
        });
      },
    );

    it('should parse JSON response body when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'application/json' };
                body: User[];
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'GET',
      });

      const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;
      expect(responseObject.body).toEqual(users);
    });

    it.each(['text/plain', 'text/html', 'application/xml'] as const)(
      'should parse plain text response bodies when converting to object with includeBody (%s)',
      async (contentType) => {
        type Schema = HttpSchema<{
          '/users': {
            GET: {
              response: {
                200: {
                  headers: { 'content-type': typeof contentType };
                  body: string;
                };
              };
            };
          };
        }>;

        const fetch = createFetch<Schema>({ baseURL });

        const request = new fetch.Request('/users', {
          method: 'GET',
        });

        const body = '<h1>Users</h1>';

        const response = new FetchResponse<Schema, 'GET', '/users'>(request, body, {
          status: 200,
          headers: { 'content-type': contentType },
        });

        const responseObject = await response.toObject({ includeBody: true });
        expect(responseObject.body).toBe(body);
      },
    );

    it.each(['application/pdf', 'image/png', 'audio/mp3', 'video/mp4', 'font/woff2', 'multipart/mixed'])(
      'should parse blob response bodies when converting to object with includeBody (%s)',
      async (contentType) => {
        type Schema = HttpSchema<{
          '/users': {
            GET: {
              response: {
                200: {
                  headers: { 'content-type': typeof contentType };
                  body: Blob;
                };
              };
            };
          };
        }>;

        const fetch = createFetch<Schema>({ baseURL });

        const request = new fetch.Request('/users', {
          method: 'GET',
        });

        const body = new Blob(['blob content'], { type: contentType });

        const response = new FetchResponse<Schema, 'GET', '/users'>(request, body, {
          status: 200,
          headers: { 'content-type': contentType },
        });

        const responseObject = await response.toObject({ includeBody: true });
        expect(responseObject.body).toEqual(body);
      },
    );

    it.each(['', undefined, null])(
      'should parse empty response body as null when converting to object with includeBody (body: %o)',
      async (body) => {
        type Schema = HttpSchema<{
          '/users': {
            GET: {
              response: {
                200: {
                  headers: { 'content-type': 'application/json' };
                  body?: string | null;
                };
              };
            };
          };
        }>;

        const fetch = createFetch<Schema>({ baseURL });

        const request = new fetch.Request('/users', {
          method: 'GET',
        });

        const response = new FetchResponse<Schema, 'GET', '/users'>(request, body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const responseObject = await response.toObject({ includeBody: true });
        expect(responseObject.body).toBeNull();
      },
    );

    it('should parse unknown JSON content type bodies as JSON when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'unknown' };
                body: User[];
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'GET',
      });

      const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'unknown' },
      });

      const responseObject = await response.toObject({ includeBody: true });
      expect(responseObject.body).toEqual(users);
    });

    it('should parse unknown non-JSON content type bodies as blob when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'unknown' };
                body: string;
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'GET',
      });

      const bodyAsString = 'response blob content';

      const response = new FetchResponse<Schema, 'GET', '/users'>(request, bodyAsString, {
        status: 200,
        headers: { 'content-type': 'unknown' },
      });

      const responseObject = await response.toObject({ includeBody: true });
      expect(responseObject.body).toBeInstanceOf(Blob);
      expect(await (responseObject.body as Blob).text()).toBe(bodyAsString);
    });

    it('should show a warning if trying to include a response body already used in plain objects', async () => {
      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'application/json' };
                body: User[];
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'GET',
      });

      const response = new FetchResponse<Schema, 'GET', '/users'>(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      expect(response.bodyUsed).toBe(false);
      expect(await response.json()).toEqual(users);
      expect(response.bodyUsed).toBe(true);

      await usingIgnoredConsole(['warn'], async (console) => {
        const responseObject = await response.toObject({ includeBody: true });

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Could not include the response body because it is already used. If you access the body ' +
            'before calling `error.toObject()`, consider reading it from a cloned response.\n\n' +
            'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
        );

        expect(responseObject.body).toBeUndefined();
      });
    });
  });
});
