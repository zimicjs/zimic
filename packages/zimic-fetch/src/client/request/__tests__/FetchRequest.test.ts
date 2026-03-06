import {
  HttpFormData,
  HttpSchema,
  HttpSearchParams,
  InvalidFormDataError,
  InvalidJSONError,
  JSONValue,
  StrictFormData,
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

      GET: {
        request: {
          searchParams?: { page?: number; limit?: number };
        };
        response: {
          200: { body: User[] };
        };
      };
    };

    '/users/form-data': {
      POST: {
        request: {
          headers?: { 'content-type'?: 'multipart/form-data' };
          body: HttpFormData<{ id: string; name: string }>;
        };
        response: {
          201: {};
        };
      };
    };
  }>;

  const fetch = createFetch<Schema>({ baseURL });

  it('instantiates request objects directly', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expectTypeOf(request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();
    expect(request).toBeInstanceOf(FetchRequest);

    expect(request.url).toBe(joinURL(baseURL, '/users'));
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.json()).toEqual(users[0]);
  });

  it('instantiates request objects from a fetch instance', async () => {
    const request = new fetch.Request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expectTypeOf(request).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();
    expect(request).toBeInstanceOf(FetchRequest);

    expect(request.url).toBe(joinURL(baseURL, '/users'));
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(await request.json()).toEqual(users[0]);
  });

  it('is an instance of Request', () => {
    const request = new FetchRequest(fetch, '/users', { method: 'GET' });
    expect(request satisfies Request).toBeInstanceOf(Request);
  });

  it('inherits all properties from Request', () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expectTypeOf(request.url).toEqualTypeOf<string>();
    expect(request.url).toBe(joinURL(baseURL, '/users'));

    expectTypeOf(request.method).toEqualTypeOf<'POST'>();
    expect(request.method).toBe('POST');

    expectTypeOf(request.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    expect(request.headers).toBeInstanceOf(Headers);
    expect(request.headers.get('content-type')).toBe('application/json');

    expectTypeOf(request.mode).toEqualTypeOf<RequestMode>();
    expect(request.mode).toBe('cors');

    expectTypeOf(request.cache).toEqualTypeOf<RequestCache>();
    expect(request.cache).toBe('default');

    expectTypeOf(request.credentials).toEqualTypeOf<RequestCredentials>();
    expect(request.credentials).toBe('same-origin');

    expectTypeOf(request.destination).toEqualTypeOf<RequestDestination>();
    expect(request.destination).toBe('');

    expectTypeOf(request.integrity).toEqualTypeOf<string>();
    expect(request.integrity).toBe('');

    expectTypeOf(request.keepalive).toEqualTypeOf<boolean>();
    expect(request.keepalive).toBe(false);

    expectTypeOf(request.redirect).toEqualTypeOf<RequestRedirect>();
    expect(request.redirect).toBe('follow');

    expectTypeOf(request.referrer).toEqualTypeOf<string>();
    expect(request.referrer).toBe('about:client');

    expectTypeOf(request.referrerPolicy).toEqualTypeOf<ReferrerPolicy>();
    expect(request.referrerPolicy).toBe('');

    expectTypeOf(request.signal).toEqualTypeOf<AbortSignal>();
    expect(request.signal).toBeInstanceOf(AbortSignal);

    expectTypeOf(request.body).toEqualTypeOf<ReadableStream<Uint8Array<ArrayBuffer>> | null>();
    expect(request.body).toBeInstanceOf(ReadableStream);

    expectTypeOf(request.bodyUsed).toEqualTypeOf<boolean>();
    expect(request.bodyUsed).toBe(false);
  });

  it('supports accessing the underlying raw Request instance', () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expectTypeOf(request.raw).toEqualTypeOf<Request>();
    expect(request.raw).toBeInstanceOf(Request);
    expect(request.raw).not.toBe(request);

    expect(request.raw.url).toBe(request.url);
    expect(request.raw.method).toBe(request.method);
    expect(request.raw.headers.get('content-type')).toBe(request.headers.get('content-type'));
    expect(request.raw.mode).toBe(request.mode);
    expect(request.raw.cache).toBe(request.cache);
    expect(request.raw.credentials).toBe(request.credentials);
    expect(request.raw.destination).toBe(request.destination);
    expect(request.raw.integrity).toBe(request.integrity);
    expect(request.raw.keepalive).toBe(request.keepalive);
    expect(request.raw.redirect).toBe(request.redirect);
    expect(request.raw.referrer).toBe(request.referrer);
    expect(request.raw.referrerPolicy).toBe(request.referrerPolicy);
    expect(request.raw.signal).toBe(request.signal);
    expect(request.raw.body).toBe(request.body);
    expect(request.raw.bodyUsed).toBe(request.bodyUsed);
  });

  it('supports accessing the path of the request', () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expectTypeOf(request.path).toEqualTypeOf<'/users'>();
    expect(request.path).toBe('/users');
  });

  it('supports reading the body of the request as JSON', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.json).toEqualTypeOf<() => Promise<User>>();
    expect(await request.json()).toEqual(users[0]);

    expect(request.bodyUsed).toBe(true);
  });

  it('supports reading the body of the request as text', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.text).toEqualTypeOf<() => Promise<string>>();
    expect(await request.text()).toBe(JSON.stringify(users[0]));

    expect(request.bodyUsed).toBe(true);
  });

  it('supports reading the body of the request as FormData', async () => {
    const formData = new HttpFormData<{ id: string; name: string }>();
    formData.append('id', users[0].id);
    formData.append('name', users[0].name);

    const request = new FetchRequest(fetch, '/users/form-data', { method: 'POST', body: formData });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.formData).toEqualTypeOf<() => Promise<StrictFormData<{ id: string; name: string }>>>();

    const requestFormData = await request.formData();
    expect(requestFormData.get('id')).toBe(users[0].id);
    expect(requestFormData.get('name')).toBe(users[0].name);

    expect(request.bodyUsed).toBe(true);
  });

  it('supports reading the body of the request as ArrayBuffer', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();

    const arrayBuffer = await request.arrayBuffer();
    const decodedString = new TextDecoder().decode(arrayBuffer);
    expect(decodedString).toBe(JSON.stringify(users[0]));

    expect(request.bodyUsed).toBe(true);
  });

  it('supports reading the body of the request as blob', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.blob).toEqualTypeOf<() => Promise<Blob>>();

    const blob = await request.blob();
    const decodedString = await blob.text();
    expect(decodedString).toBe(JSON.stringify(users[0]));

    expect(request.bodyUsed).toBe(true);
  });

  it('supports reading the body of the request as bytes', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    expect(request.bodyUsed).toBe(false);

    expectTypeOf(request.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    const bytes = await request.bytes();
    const decodedString = new TextDecoder().decode(bytes);
    expect(decodedString).toBe(JSON.stringify(users[0]));

    expect(request.bodyUsed).toBe(true);
  });

  it('supports being cloned', async () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    const clonedRequest = request.clone();

    expectTypeOf(clonedRequest).toEqualTypeOf<FetchRequest<Schema, 'POST', '/users'>>();
    expect(clonedRequest).toBeInstanceOf(FetchRequest);
    expect(clonedRequest).not.toBe(request);
    expect(clonedRequest.raw).not.toBe(request.raw);

    expect(clonedRequest.url).toBe(request.url);
    expect(clonedRequest.path).toBe(request.path);
    expect(clonedRequest.method).toBe(request.method);
    expect(clonedRequest.headers.get('content-type')).toBe(request.headers.get('content-type'));
    expect(clonedRequest.mode).toBe(request.mode);
    expect(clonedRequest.cache).toBe(request.cache);
    expect(clonedRequest.credentials).toBe(request.credentials);
    expect(clonedRequest.destination).toBe(request.destination);
    expect(clonedRequest.integrity).toBe(request.integrity);
    expect(clonedRequest.keepalive).toBe(request.keepalive);
    expect(clonedRequest.redirect).toBe(request.redirect);
    expect(clonedRequest.referrer).toBe(request.referrer);
    expect(clonedRequest.referrerPolicy).toBe(request.referrerPolicy);
    expect(clonedRequest.signal).not.toBe(request.signal);
    expect(clonedRequest.body).toBeInstanceOf(ReadableStream);
    expect(clonedRequest.body).not.toBe(request.body);
    expect(clonedRequest.bodyUsed).toBe(false);

    expect(await clonedRequest.json()).toEqual(users[0]);

    expect(clonedRequest.bodyUsed).toBe(true);
    expect(request.bodyUsed).toBe(false);
  });

  it('does not redeclare methods from Request on access', () => {
    const request = new FetchRequest(fetch, '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    // These methods are bound to the internal request instance because they access internal state. However,
    // this binding should be done only once to avoid unnecessary memory allocation on every access.
    expect(request.json).toBe(request.json);
    expect(request.text).toBe(request.text);
    expect(request.formData).toBe(request.formData);
    expect(request.arrayBuffer).toBe(request.arrayBuffer);
    expect(request.blob).toBe(request.blob);
    expect(request.bytes).toBe(request.bytes);
  });

  describe('toObject', () => {
    it.each([{ includeBody: undefined }, { includeBody: false as const }])(
      'generates a FetchRequestObject (%o)',
      ({ includeBody }) => {
        const request = new FetchRequest(fetch, '/users', {
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

    it('parses JSON request body when converting to object including body', async () => {
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

      const request = new FetchRequest(fetch, '/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;
      expect(requestObject.body).toEqual(users[0]);
    });

    it('parses FormData request body when converting to object including body', async () => {
      interface RequestBodySchema {
        id: string;
        names: string[];
      }

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers?: { 'content-type'?: 'multipart/form-data' };
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

      const request = new FetchRequest(fetch, '/users', { method: 'POST', body });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;

      expect(requestObject.body).toBeInstanceOf(HttpFormData);
      expect(Array.from((requestObject.body as FormData).entries())).toEqual([
        ['id', users[0].id],
        ['names', users[0].name],
        ['names', users[1].name],
      ]);
    });

    it('parses URL search params request body when converting to object including body', async () => {
      interface RequestBodySchema {
        page: number;
        limit: number;
      }

      type Schema = HttpSchema<{
        '/users': {
          POST: {
            request: {
              headers?: { 'content-type'?: 'application/x-www-form-urlencoded' };
              body: HttpSearchParams<RequestBodySchema>;
            };
            response: {
              201: {};
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new FetchRequest(fetch, '/users', {
        method: 'POST',
        body: new HttpSearchParams<RequestBodySchema>({ page: 1, limit: 20 }),
      });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;

      expect(requestObject.body).toBeInstanceOf(HttpSearchParams);
      expect(Array.from((requestObject.body as HttpSearchParams<RequestBodySchema>).entries())).toEqual([
        ['page', '1'],
        ['limit', '20'],
      ]);
    });

    it('parses empty request body as null when converting to object including body', async () => {
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

      const request = new FetchRequest(fetch, '/users', { method: 'POST' });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;
      expect(requestObject.body).toBe(null);
    });

    it('parses unknown JSON content type bodies as JSON when converting to object including body', async () => {
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

      const request = new FetchRequest(fetch, '/users', {
        method: 'POST',
        headers: { 'content-type': 'unknown' },
        body: JSON.stringify(users[0]),
      });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;
      expect(requestObject.body).toEqual(users[0]);
    });

    it('parses unknown non-JSON content type bodies as blob when converting to object including body', async () => {
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

      const request = new FetchRequest(fetch, '/users', {
        method: 'POST',
        headers: { 'content-type': 'unknown' },
        body: bodyAsString,
      });

      const requestObjectPromise = request.toObject({ includeBody: true });
      expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

      const requestObject = await requestObjectPromise;

      expect(requestObject.body).toBeInstanceOf(Blob);
      const bodyAsBlob = requestObject.body as Blob;
      expect(await bodyAsBlob.text()).toBe(bodyAsString);
    });

    it('logs an error when parsing invalid request bodies when converting to object including body', async () => {
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

      const invalidJSONRequest = new FetchRequest(fetch, '/users-json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: invalidJSONBody,
      });

      const invalidFormDataRequest = new FetchRequest(fetch, '/users-form-data', {
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

    it('shows a warning if trying to include a request body already used in plain objects', async () => {
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

      const request = new FetchRequest(fetch, '/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(users[0]),
      });

      expect(request.bodyUsed).toBe(false);
      expect(await request.json()).toEqual(users[0]);
      expect(request.bodyUsed).toBe(true);

      await usingIgnoredConsole(['warn'], async (console) => {
        const requestObjectPromise = request.toObject({ includeBody: true });
        expectTypeOf(requestObjectPromise).toEqualTypeOf<Promise<FetchRequestObject>>();

        const requestObject = await requestObjectPromise;

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Could not include the request body because it is already used. If you access the body ' +
            'before calling `toObject()`, consider reading it from a cloned request.\n\n' +
            'Learn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject',
        );

        expect(requestObject.body).toBeUndefined();
      });
    });
  });
});
