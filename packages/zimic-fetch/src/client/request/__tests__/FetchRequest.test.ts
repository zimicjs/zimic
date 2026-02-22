import {
  HttpFormData,
  HttpSchema,
  HttpSearchParams,
  InvalidFormDataError,
  InvalidJSONError,
  JSONValue,
  StrictHeaders,
} from '@zimic/http';
import { joinURL } from '@zimic/utils/url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';

import createFetch from '../../factory';
import { FetchRequest } from '../FetchRequest';
import { FetchRequestObject } from '../types';

describe('FetchRequest', () => {
  const baseURL = 'http://localhost:3000';

  type User = JSONValue<{
    id: string;
    name: string;
  }>;

  const users: User[] = [
    { id: '1', name: 'User 1' },
    { id: '2', name: 'User 2' },
  ];

  it('should support making creating FetchRequest objects directly', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            searchParams: { page: number };
            body: User;
          };
          response: {
            201: { body: User };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      searchParams: { page: 1 },
      body: JSON.stringify(users[0]),
    });

    expect(request.url).toBe(joinURL(baseURL, '/users?page=1'));

    expectTypeOf(request.method).toEqualTypeOf<'POST'>();
    expect(request.method).toBe('POST');

    expectTypeOf(request.path).toEqualTypeOf<'/users'>();
    expect(request.path).toBe('/users');

    expectTypeOf(request.raw).toEqualTypeOf<Request>();
    expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    expectTypeOf(request.body).toEqualTypeOf<ReadableStream<Uint8Array<ArrayBuffer>> | null>();
    expectTypeOf(request.bodyUsed).toEqualTypeOf<boolean>();
    expectTypeOf(request.clone).toEqualTypeOf<() => FetchRequest<Schema, 'POST', '/users'>>();
    expectTypeOf(request.json).toEqualTypeOf<() => Promise<User>>();
    expectTypeOf(request.text).toEqualTypeOf<() => Promise<string>>();
    expectTypeOf(request.formData).toEqualTypeOf<() => Promise<FormData>>();
    expectTypeOf(request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
    expectTypeOf(request.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    expect(await request.json()).toEqual(users[0]);
  });

  it('should support making creating FetchRequest objects from a fetch instance', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          request: {
            searchParams: { page: number; limit: number };
          };
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
      searchParams: { page: 2, limit: 10 },
    });

    expect(request).toBeInstanceOf(FetchRequest);
    expect(request.url).toBe(joinURL(baseURL, '/users?page=2&limit=10'));

    expectTypeOf(request.method).toEqualTypeOf<'GET'>();
    expectTypeOf(request.path).toEqualTypeOf<'/users'>();

    expect(request.path).toBe('/users');
    expect(request.method).toBe('GET');
  });

  it('should be an instance of Request', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    expect(request).toBeInstanceOf(FetchRequest);
    expect(request).toBeInstanceOf(Request);
  });

  it('should implement all properties and methods from Request', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
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

    for (const property of Reflect.ownKeys(Request.prototype)) {
      if (property === 'constructor') {
        continue;
      }

      expect(property in request).toBe(true);
    }

    const textFromDetachedMethod = request.clone().text;
    expect(await textFromDetachedMethod()).toBe(JSON.stringify(users[0]));

    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.url).toBe(joinURL(baseURL, '/users'));
    expect(request.bodyUsed).toBe(false);
  });

  it('should allow accessing the raw Request object', () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>;

    const fetch = createFetch<Schema>({ baseURL });

    const request = new fetch.Request('/users', {
      method: 'GET',
    });

    expect(request.raw).toBeInstanceOf(Request);
    expect(request.raw).not.toBe(request);
    expect(request.raw.url).toBe(request.url);
  });

  it('should correctly generate a new FetchRequest clone', async () => {
    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: {
            headers: { 'content-type': 'application/json' };
            body: User;
          };
          response: {
            201: { body: User };
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

    const clone = request.clone();

    expect(clone).toBeInstanceOf(FetchRequest);
    expect(clone).not.toBe(request);
    expect(clone.raw).not.toBe(request.raw);

    expectTypeOf(clone).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();
    expectTypeOf(clone.clone).toEqualTypeOf<() => typeof clone>();
    expectTypeOf(clone.json).toEqualTypeOf<() => Promise<User>>();
    expectTypeOf(clone.text).toEqualTypeOf<() => Promise<string>>();
    expectTypeOf(clone.formData).toEqualTypeOf<() => Promise<FormData>>();
    expectTypeOf(clone.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();
    expectTypeOf(clone.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    expect(clone.url).toBe(request.url);
    expect(clone.path).toBe(request.path);
    expect(clone.method).toBe(request.method);
    expect(await clone.json()).toEqual(users[0]);

    expect(request.bodyUsed).toBe(false);
    expect(await request.json()).toEqual(users[0]);
  });

  describe('toObject', () => {
    it.each([{ includeBody: undefined }, { includeBody: false as const }])(
      'should correctly generated a FetchRequestObject (%o)',
      ({ includeBody }) => {
        type Schema = HttpSchema<{
          '/users': {
            POST: {
              request: {
                headers: { 'content-type': 'application/json' };
                body: User;
              };
              response: {
                201: {};
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

        const requestObject = request.toObject({ includeBody });
        expectTypeOf(requestObject).toEqualTypeOf<FetchRequestObject>();

        expect(requestObject).toEqual<FetchRequestObject>({
          url: joinURL(baseURL, '/users'),
          path: '/users',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'default',
          destination: '',
          credentials: 'same-origin',
          integrity: '',
          keepalive: false,
          mode: 'cors',
          redirect: 'follow',
          referrer: 'about:client',
          referrerPolicy: '',
        });
      },
    );

    it('should parse JSON request body when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
            response: {
              201: {};
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

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;
      expect(requestObject.body).toEqual(users[0]);
    });

    it('should parse form data request body when converting to object with includeBody', async () => {
      interface RequestBodySchema {
        id: string;
        names: string[];
      }

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpFormData<RequestBodySchema>;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const body = new HttpFormData<RequestBodySchema>();
      body.append('id', users[0].id);
      body.append('names', users[0].name);
      body.append('names', users[1].name);

      const request = new fetch.Request('/users', {
        method: 'POST',
        body,
      });

      const requestObject = await request.toObject({ includeBody: true });

      expect(requestObject.body).toBeInstanceOf(HttpFormData);
      expect(Array.from((requestObject.body as FormData).entries())).toEqual([
        ['id', users[0].id],
        ['names', users[0].name],
        ['names', users[1].name],
      ]);
    });

    it('should parse URL search params request body when converting to object with includeBody', async () => {
      interface RequestBodySchema {
        page: number;
        limit: number;
      }

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              body: HttpSearchParams<RequestBodySchema>;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const body = new HttpSearchParams<RequestBodySchema>({
        page: 1,
        limit: 20,
      });

      const request = new fetch.Request('/users', {
        method: 'POST',
        body,
      });

      const requestObject = await request.toObject({ includeBody: true });

      expect(requestObject.body).toBeInstanceOf(HttpSearchParams);
      expect(Array.from((requestObject.body as URLSearchParams).entries())).toEqual([
        ['page', '1'],
        ['limit', '20'],
      ]);
    });

    it('should parse empty request body as null when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'POST',
      });

      const requestObject = await request.toObject({ includeBody: true });
      expect(requestObject.body).toBeNull();
    });

    it('should parse unknown JSON content type bodies as JSON when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'unknown' };
              body: User;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', {
        method: 'POST',
        headers: { 'content-type': 'unknown' },
        body: JSON.stringify(users[0]),
      });

      const requestObject = await request.toObject({ includeBody: true });
      expect(requestObject.body).toEqual(users[0]);
    });

    it('should parse unknown non-JSON content type bodies as blob when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'unknown' };
              body: string;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const bodyAsString = 'request blob content';

      const request = new fetch.Request('/users', {
        method: 'POST',
        headers: { 'content-type': 'unknown' },
        body: bodyAsString,
      });

      const requestObject = await request.toObject({ includeBody: true });

      expect(requestObject.body).toBeInstanceOf(Blob);
      expect(await (requestObject.body as Blob).text()).toBe(bodyAsString);
    });

    it('should log an error when parsing invalid request bodies when converting to object with includeBody', async () => {
      type Schema = HttpSchema<{
        '/users-json': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: string;
            };
            response: {
              201: {};
            };
          };
        };
        '/users-form-data': {
          POST: {
            request: {
              headers: { 'content-type': 'multipart/form-data' };
              body: string;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const invalidJSONBody = 'invalid request json body';
      const invalidFormDataBody = 'invalid request form data body';

      const invalidJSONRequest = new fetch.Request('/users-json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: invalidJSONBody,
      });

      const invalidFormDataRequest = new fetch.Request('/users-form-data', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data' },
        body: invalidFormDataBody,
      });

      await usingIgnoredConsole(['error'], async (console) => {
        const jsonRequestObject = await invalidJSONRequest.toObject({ includeBody: true });
        const formDataRequestObject = await invalidFormDataRequest.toObject({ includeBody: true });

        expect(console.error).toHaveBeenCalledTimes(2);

        expect(console.error).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Failed to parse request body:',
          new InvalidJSONError(invalidJSONBody),
        );

        expect(console.error).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Failed to parse request body:',
          new InvalidFormDataError(invalidFormDataBody),
        );

        expect(jsonRequestObject.body).toBeUndefined();
        expect(formDataRequestObject.body).toBeUndefined();
      });
    });

    it('should show a warning if trying to include a request body already used in plain objects', async () => {
      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers: { 'content-type': 'application/json' };
              body: User;
            };
            response: {
              201: {};
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

      expect(request.bodyUsed).toBe(false);
      expect(await request.json()).toEqual(users[0]);
      expect(request.bodyUsed).toBe(true);

      await usingIgnoredConsole(['warn'], async (console) => {
        const requestObject = await request.toObject({ includeBody: true });

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Could not include the request body because it is already used. If you access the body ' +
            'before calling `error.toObject()`, consider reading it from a cloned request.\n\n' +
            'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
        );

        expect(requestObject.body).toBeUndefined();
      });
    });
  });
});
