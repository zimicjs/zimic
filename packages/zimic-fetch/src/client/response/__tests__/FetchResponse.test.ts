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

import { FetchRequest } from '@/client/request/FetchRequest';
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

      GET: {
        response: {
          200: {
            headers: { 'content-type': 'application/json' };
            body: User[];
          };
        };
      };
    };

    '/users/form-data': {
      POST: {
        response: {
          201: {
            headers?: { 'content-type'?: 'multipart/form-data' };
            body: HttpFormData<{ id: string; name: string }>;
          };
        };
      };
    };
  }>;

  const fetch = createFetch<Schema>({ baseURL });

  it('instantiates response objects directly', async () => {
    const request = new fetch.Request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(users[0]),
    });

    const response = new FetchResponse(request, JSON.stringify(users[0]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response).toEqualTypeOf<FetchResponse<Schema, 'POST', '/users'>>();
    expect(response).toBeInstanceOf(FetchResponse);

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual(users[0]);
  });

  it('instantiates response objects from a fetch instance', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();
    expect(response).toBeInstanceOf(FetchResponse);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual(users);
  });

  it('instantiates response objects using a raw response', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const rawResponse = new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const response = new FetchResponse(request, rawResponse);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual(users);
  });

  it('is an instance of Response', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    expect(response satisfies Response).toBeInstanceOf(Response);
  });

  it('inherits all properties from Response', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response.url).toEqualTypeOf<string>();
    expect(response.url).toBe('');

    expectTypeOf(response.type).toEqualTypeOf<ResponseType>();
    expect(response.type).toBe('default');

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expect(response.status).toBe(200);

    expectTypeOf(response.statusText).toEqualTypeOf<string>();
    expect(response.statusText).toBe('');

    expectTypeOf(response.headers).toEqualTypeOf<StrictHeaders<{ 'content-type': 'application/json' }>>();
    expect(response.headers).toBeInstanceOf(Headers);
    expect(response.headers.get('content-type')).toBe('application/json');

    expectTypeOf(response.ok).toEqualTypeOf<true>();
    expect(response.ok).toBe(true);

    expectTypeOf(response.redirected).toEqualTypeOf<boolean>();
    expect(response.redirected).toBe(false);

    expectTypeOf(response.body).toEqualTypeOf<ReadableStream<Uint8Array<ArrayBuffer>> | null>();
    expect(response.body).toBeInstanceOf(ReadableStream);

    expectTypeOf(response.bodyUsed).toEqualTypeOf<boolean>();
    expect(response.bodyUsed).toBe(false);
  });

  it('supports accessing the underlying raw Response instance', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response.raw).toEqualTypeOf<Response>();
    expect(response.raw).toBeInstanceOf(Response);
    expect(response.raw).not.toBe(response);

    expect(response.raw.url).toBe(response.url);
    expect(response.raw.type).toBe(response.type);
    expect(response.raw.status).toBe(response.status);
    expect(response.raw.statusText).toBe(response.statusText);
    expect(response.raw.headers.get('content-type')).toBe(response.headers.get('content-type'));
    expect(response.raw.ok).toBe(response.ok);
    expect(response.raw.redirected).toBe(response.redirected);
    expect(response.raw.body).toBe(response.body);
    expect(response.raw.bodyUsed).toBe(response.bodyUsed);
  });

  it('supports accessing the underlying raw Response instance when created from a raw response', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const rawResponse = new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const response = new FetchResponse(request, rawResponse);

    expectTypeOf(response.raw).toEqualTypeOf<Response>();
    expect(response.raw).toBeInstanceOf(Response);
    expect(response.raw).not.toBe(response);
    expect(response.raw).toBe(rawResponse);

    expect(response.raw.url).toBe(response.url);
    expect(response.raw.type).toBe(response.type);
    expect(response.raw.status).toBe(response.status);
    expect(response.raw.statusText).toBe(response.statusText);
    expect(response.raw.headers.get('content-type')).toBe(response.headers.get('content-type'));
    expect(response.raw.ok).toBe(response.ok);
    expect(response.raw.redirected).toBe(response.redirected);
    expect(response.raw.body).toBe(response.body);
    expect(response.raw.bodyUsed).toBe(response.bodyUsed);
  });

  it('supports accessing the request that generated the response', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response.request).toEqualTypeOf<FetchRequest<Schema, 'GET', '/users'>>();
    expect(response.request).toBe(request);

    expect(request.url).toBe(joinURL(baseURL, '/users'));
    expect(response.request.path).toBe('/users');
    expect(response.request.method).toBe('GET');
  });

  it('supports accessing the response error', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expectTypeOf(response.error).toEqualTypeOf<FetchResponseError<Schema, 'GET', '/users'>>();
    expect(response.error).toBeInstanceOf(FetchResponseError);
  });

  it('supports reading the body of the response as JSON', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.json).toEqualTypeOf<() => Promise<User[]>>();
    expect(await response.json()).toEqual(users);

    expect(response.bodyUsed).toBe(true);
  });

  it('supports reading the body of the response as text', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.text).toEqualTypeOf<() => Promise<string>>();
    expect(await response.text()).toBe(JSON.stringify(users));

    expect(response.bodyUsed).toBe(true);
  });

  it('supports reading the body of the response as FormData', async () => {
    const request = new fetch.Request('/users/form-data', {
      method: 'POST',
    });

    const formData = new HttpFormData<{ id: string; name: string }>();
    formData.append('id', users[0].id);
    formData.append('name', users[0].name);

    const response = new FetchResponse<Schema, 'POST', '/users/form-data'>(request, formData, {
      status: 201,
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.formData).toEqualTypeOf<() => Promise<StrictFormData<{ id: string; name: string }>>>();

    const responseFormData = await response.formData();
    expect(responseFormData.get('id')).toBe(users[0].id);
    expect(responseFormData.get('name')).toBe(users[0].name);

    expect(response.bodyUsed).toBe(true);
  });

  it('supports reading the body of the response as ArrayBuffer', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.arrayBuffer).toEqualTypeOf<() => Promise<ArrayBuffer>>();

    const arrayBuffer = await response.arrayBuffer();
    const decodedString = new TextDecoder().decode(arrayBuffer);
    expect(decodedString).toBe(JSON.stringify(users));

    expect(response.bodyUsed).toBe(true);
  });

  it('supports reading the body of the response as blob', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.blob).toEqualTypeOf<() => Promise<Blob>>();

    const blob = await response.blob();
    const decodedString = await blob.text();
    expect(decodedString).toBe(JSON.stringify(users));

    expect(response.bodyUsed).toBe(true);
  });

  it('supports reading the body of the response as bytes', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(response.bodyUsed).toBe(false);

    expectTypeOf(response.bytes).toEqualTypeOf<() => Promise<Uint8Array<ArrayBuffer>>>();

    const bytes = await response.bytes();
    const decodedString = new TextDecoder().decode(bytes);
    expect(decodedString).toBe(JSON.stringify(users));

    expect(response.bodyUsed).toBe(true);
  });

  it('supports being cloned', async () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const clonedResponse = response.clone();

    expectTypeOf(clonedResponse).toEqualTypeOf<FetchResponse<Schema, 'GET', '/users'>>();
    expect(clonedResponse).toBeInstanceOf(FetchResponse);
    expect(clonedResponse).not.toBe(response);
    expect(clonedResponse.raw).not.toBe(response.raw);

    expect(clonedResponse.url).toBe(response.url);
    expect(clonedResponse.type).toBe(response.type);
    expect(clonedResponse.status).toBe(response.status);
    expect(clonedResponse.statusText).toBe(response.statusText);
    expect(clonedResponse.headers.get('content-type')).toBe(response.headers.get('content-type'));
    expect(clonedResponse.ok).toBe(response.ok);
    expect(clonedResponse.redirected).toBe(response.redirected);
    expect(clonedResponse.body).toBeInstanceOf(ReadableStream);
    expect(clonedResponse.request).toBe(response.request);
    expect(clonedResponse.bodyUsed).toBe(false);

    expect(await clonedResponse.json()).toEqual(users);

    expect(clonedResponse.bodyUsed).toBe(true);
    expect(response.bodyUsed).toBe(false);
  });

  it('does not redeclare methods from Response on access', () => {
    const request = new fetch.Request('/users', { method: 'GET' });

    const response = new FetchResponse(request, JSON.stringify(users), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    // These methods are bound to the internal response instance because they access internal state. However,
    // this binding is done only once to avoid unnecessary memory allocation on every access.
    expect(response.json).toBe(response.json);
    expect(response.text).toBe(response.text);
    expect(response.formData).toBe(response.formData);
    expect(response.arrayBuffer).toBe(response.arrayBuffer);
    expect(response.blob).toBe(response.blob);
    expect(response.bytes).toBe(response.bytes);
  });

  describe('toObject', () => {
    it.each([{ includeBody: undefined }, { includeBody: false as const }])(
      'generates a FetchResponseObject (%o)',
      ({ includeBody }) => {
        const request = new fetch.Request('/users', { method: 'GET' });

        const response = new FetchResponse(request, JSON.stringify(users), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

        const responseObject = response.toObject({ includeBody });
        expectTypeOf(responseObject).toEqualTypeOf<FetchResponseObject>();

        expect(responseObject).toEqual<FetchResponseObject>({
          url: '',
          type: 'default',
          status: 200,
          statusText: '',
          ok: true,
          headers: { 'content-type': 'application/json' },
          redirected: false,
        });
      },
    );

    it('parses JSON response body when converting to object including body', async () => {
      const request = new fetch.Request('/users', { method: 'GET' });

      const response = new FetchResponse(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;
      expect(responseObject.body).toEqual(users);
    });

    it('parses FormData response body when converting to object including body', async () => {
      interface ResponseBodySchema {
        id: string;
        names: string[];
      }

      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers?: { 'content-type'?: 'multipart/form-data' };
                body: HttpFormData<ResponseBodySchema>;
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'GET' });

      const body = new HttpFormData<ResponseBodySchema>();
      body.append('id', users[0].id);
      body.append('names', users[0].name);
      body.append('names', users[1].name);

      const response = new FetchResponse(request, body, { status: 200 });

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;

      expect(responseObject.body).toBeInstanceOf(HttpFormData);
      expect(Array.from((responseObject.body as FormData).entries())).toEqual([
        ['id', users[0].id],
        ['names', users[0].name],
        ['names', users[1].name],
      ]);
    });

    it('parses URL search params response body when converting to object including body', async () => {
      interface ResponseBodySchema {
        page: number;
        limit: number;
      }

      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: {
              200: {
                headers?: { 'content-type'?: 'application/x-www-form-urlencoded' };
                body: HttpSearchParams<ResponseBodySchema>;
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const request = new fetch.Request('/users', { method: 'GET' });

      const response = new FetchResponse(
        request,
        new HttpSearchParams<ResponseBodySchema>({
          page: 1,
          limit: 20,
        }),
        { status: 200 },
      );

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;

      expect(responseObject.body).toBeInstanceOf(HttpSearchParams);
      expect(Array.from((responseObject.body as URLSearchParams).entries())).toEqual([
        ['page', '1'],
        ['limit', '20'],
      ]);
    });

    it('parses empty response body as null when converting to object including body', async () => {
      const request = new fetch.Request('/users', { method: 'GET' });

      const response = new FetchResponse(request, new Response(undefined, { status: 200 }));

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;
      expect(responseObject.body).toBe(null);
    });

    it('parses unknown JSON content type bodies as JSON when converting to object including body', async () => {
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

      const request = new fetch.Request('/users', { method: 'GET' });

      const response = new FetchResponse(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'unknown' },
      });

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;
      expect(responseObject.body).toEqual(users);
    });

    it('parses unknown non-JSON content type bodies as blob when converting to object including body', async () => {
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

      const request = new fetch.Request('/users', { method: 'GET' });

      const bodyAsString = 'response blob content';

      const response = new FetchResponse(request, bodyAsString, {
        status: 200,
        headers: { 'content-type': 'unknown' },
      });

      const responseObjectPromise = response.toObject({ includeBody: true });
      expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

      const responseObject = await responseObjectPromise;

      expect(responseObject.body).toBeInstanceOf(Blob);
      const bodyAsBlob = responseObject.body as Blob;
      expect(await bodyAsBlob.text()).toBe(bodyAsString);
    });

    it('logs an error when parsing invalid response bodies when converting to object including body', async () => {
      type Schema = HttpSchema<{
        '/users-json': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'application/json' };
                body: string;
              };
            };
          };
        };
        '/users-form-data': {
          GET: {
            response: {
              200: {
                headers: { 'content-type': 'multipart/form-data' };
                body: string;
              };
            };
          };
        };
      }>;

      const fetch = createFetch<Schema>({ baseURL });

      const invalidJSONBody = 'invalid response json body';
      const invalidFormDataBody = 'invalid response form data body';

      const invalidJSONRequest = new fetch.Request('/users-json', { method: 'GET' });
      const invalidFormDataRequest = new fetch.Request('/users-form-data', { method: 'GET' });

      const invalidJSONResponse = new FetchResponse(invalidJSONRequest, invalidJSONBody, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const invalidFormDataResponse = new FetchResponse(invalidFormDataRequest, invalidFormDataBody, {
        status: 200,
        headers: { 'content-type': 'multipart/form-data' },
      });

      await usingIgnoredConsole(['error'], async (console) => {
        const jsonResponseObject = await invalidJSONResponse.toObject({ includeBody: true });
        const formDataResponseObject = await invalidFormDataResponse.toObject({ includeBody: true });

        expect(console.error).toHaveBeenCalledTimes(2);

        expect(console.error).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Failed to parse response body:',
          new InvalidJSONError(invalidJSONBody),
        );

        expect(console.error).toHaveBeenCalledWith(
          '[@zimic/fetch]',
          'Failed to parse response body:',
          new InvalidFormDataError(invalidFormDataBody),
        );

        expect(jsonResponseObject.body).toBeUndefined();
        expect(formDataResponseObject.body).toBeUndefined();
      });
    });

    it('shows a warning if trying to include a response body already used in plain objects', async () => {
      const request = new fetch.Request('/users', { method: 'GET' });

      const response = new FetchResponse(request, JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      expect(response.bodyUsed).toBe(false);
      expect(await response.json()).toEqual(users);
      expect(response.bodyUsed).toBe(true);

      await usingIgnoredConsole(['warn'], async (console) => {
        const responseObjectPromise = response.toObject({ includeBody: true });
        expectTypeOf(responseObjectPromise).toEqualTypeOf<Promise<FetchResponseObject>>();

        const responseObject = await responseObjectPromise;

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
