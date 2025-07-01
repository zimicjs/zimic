---
title: fetch | @zimic/fetch
sidebar_label: fetch
slug: /fetch/api/fetch
---

# `fetch`

The result of [`createFetch`](/docs/zimic-fetch/api/1-create-fetch.md) is a fetch instance typed with an HTTP schema,
mostly compatible with the native [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API).

Requests sent by the fetch instance have their URL automatically prefixed with the base URL of the instance.
[Default options](#fetchdefaults) are also applied to the requests, if provided.

```ts
fetch(input);
fetch(input, init);
```

**Arguments**:

1. **input**: `string | URL | FetchRequest`

   The resource to fetch, either a path, a URL, or another [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md)
   request. If a path is provided, it is automatically prefixed with the base URL of the fetch instance when the request
   is sent. If a URL or a request is provided, it is used as is.

2. **init**: `FetchRequestInit`

   The options to use for the request. If a path or a URL is provided as the first argument, this argument is required
   and should contain at least the method of the request. If the first argument is a
   [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md), this argument is optional. The options inherit from the
   native [`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) interface, with the following
   additional properties:

   - **method**: `string`

     The HTTP method to use for the request. Differently from the native Fetch API, this is required to ensure that
     requests are typed correctly.

   - **baseURL**: `string | undefined`

     The base URL for the request. If provided, it will have preference over the default base URL of the fetch instance.

   - **searchParams**: `HttpSearchParamsSchema.Loose | undefined`

     The search parameters to be sent with the request. If provided, it will have preference over the default search
     parameters of the fetch instance.

   - **duplex**: `'half' | undefined`

     The duplex mode for the request. If set to `'half'`, the request body will be streamed. See
     [Request streaming](/docs/zimic-fetch/guides/4-bodies.md#request-streaming) for more details.

**Returns**: `Promise<FetchResponse>`

A promise that resolves to a [`FetchResponse`](/docs/zimic-fetch/api/4-fetch-response.md), which is typed with the
schema of the fetch instance.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { query?: string };
      };
      response: {
        200: { body: User[] };
        404: { body: { message: string } };
        500: { body: { message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

// highlight-start
const response = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'u' },
});
// highlight-end

if (response.status === 404) {
  return null; // User not found
}

if (!response.ok) {
  throw response.error;
}

const users = await response.json();
return users; // User[]
```

## `fetch.defaults`

The default options for each request sent by the fetch instance.

**Type**: `FetchDefaults`

`fetch.defaults` inherits from the native [`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit)
interface, with the following additional properties:

- **baseURL**: `string | undefined`

  The base URL for the fetch instance, which will be prepended to all request URLs.

- **searchParams**: `HttpSearchParamsSchema.Loose | undefined`

  The default search parameters to be sent with each request.

- **duplex**: `'half' | undefined`

  The duplex mode for the fetch instance. If set to `'half'`, the request body will be streamed. See
  [Request streaming](/docs/zimic-fetch/guides/4-bodies.md#request-streaming) for more details.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface Post {
  id: string;
  title: string;
}

type Schema = HttpSchema<{
  '/posts': {
    POST: {
      request: {
        headers: { authorization?: string };
        body: { title: string };
      };
      response: {
        201: { body: Post };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

//  highlight-next-line
fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
```

**Related**:

- [Guides - Authentication](/docs/zimic-fetch/guides/5-authentication.md#handling-errors)

## `fetch.onRequest`

A listener function that is called before sending each request.

**Type**: `(request: FetchRequest.Loose) => Promise<Request> | Request`

**Arguments**:

1. **request**: `FetchRequest.Loose`

   The [request](/docs/zimic-fetch/api/3-fetch-request.md) to be sent.

**Returns**: `Promise<Request> | Request`

The request to use, either a modified version of the original request or a new one.

```ts
import { createFetch } from '@zimic/fetch';
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { page?: number; limit?: number };
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:80',
});

//  highlight-start
fetch.onRequest = (request) => {
  if (fetch.isRequest(request, 'GET', '/users')) {
    const url = new URL(request.url);
    url.searchParams.append('limit', '10');

    const updatedRequest = new Request(url, request);
    return updatedRequest;
  }

  return request;
};
//  highlight-end
```

**Related**:

- [`createFetch` - `onRequest` API reference](/docs/zimic-fetch/api/1-create-fetch.md#onrequest)
- [Guides - Authentication](/docs/zimic-fetch/guides/5-authentication.md#handling-errors)
- [Guides - Handling errors](/docs/zimic-fetch/guides/6-errors.md)

## `fetch.onResponse`

A listener function that is called after receiving each response.

**Type**: `(response: FetchResponse.Loose) => Promise<Response> | Response`

**Arguments**:

1. **response**: `FetchResponse.Loose`

   The [response](/docs/zimic-fetch/api/4-fetch-response.md) received from the server.

**Returns**: `Promise<Response> | Response`

The response to use, either a modified version of the original response or a new one.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: {
        200: {
          headers: { 'content-encoding'?: string };
          body: User[];
        };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:80',
});

//  highlight-start
fetch.onResponse = (response) => {
  if (fetch.isResponse(response, 'GET', '/users')) {
    console.log(response.headers.get('content-encoding'));
  }
  return response;
};
//  highlight-end
```

**Related**:

- [`createFetch` - `onResponse` API reference](/docs/zimic-fetch/api/1-create-fetch.md#onresponse)
- [Guides - Authentication](/docs/zimic-fetch/guides/5-authentication.md#handling-errors)
- [Guides - Handling errors](/docs/zimic-fetch/guides/6-errors.md)

## `fetch.loose`

A loosely-typed version of `fetch`. This can be useful to make requests with fewer type constraints, such as in
[`onRequest`](#fetchonrequest) and [`onResponse`](#fetchonrequest) listeners.

```ts
fetch.loose(input);
fetch.loose(input, init);
```

**Arguments**:

1. **input**: `string | URL | FetchRequest`

   The resource to fetch, either a path, a URL, or another [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md)
   request. If a path is provided, it is automatically prefixed with the base URL of the fetch instance when the request
   is sent. If a URL or a request is provided, it is used as is.

2. **init**: `FetchRequestInit`

   The options to use for the request. If a path or a URL is provided as the first argument, this argument is required
   and should contain at least the method of the request. If the first argument is a
   [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md), this argument is optional. The options inherit from the
   native [`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) interface, with the following
   additional properties:

   - **method**: `string | undefined`

     The HTTP method to use for the request.

   - **baseURL**: `string | undefined`

     The base URL for the request. If provided, it will have preference over the default base URL of the fetch instance.

   - **searchParams**: `HttpSearchParamsSchema.Loose | undefined`

     The search parameters to be sent with the request. If provided, it will have preference over the default search
     parameters of the fetch instance.

   - **duplex**: `'half' | undefined`

     The duplex mode for the request. If set to `'half'`, the request body will be streamed. See
     [Request streaming](/docs/zimic-fetch/guides/4-bodies.md#request-streaming) for more details.

See our [authentication guide](/docs/zimic-fetch/guides/5-authentication.md#handling-errors) for an example of how to
use `fetch.loose`.

## `fetch.Request`

A constructor for creating a [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md) instance, which inherits from
the native [Request](https://developer.mozilla.org/docs/Web/API/Request) and receives the same arguments as `fetch`.

```ts
new fetch.Request(input);
new fetch.Request(input, init);
```

**Arguments**:

1. **input**: `string | URL | FetchRequest`

   The resource to fetch, either a path, a URL, or another [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md)
   request. If a path is provided, it is automatically prefixed with the base URL of the fetch instance when the request
   is sent. If a URL or a request is provided, it is used as is.

2. **init**: `FetchRequestInit | undefined`

   The options to use for the request. If a path or a URL is provided as the first argument, this argument is required
   and should contain at least the method of the request. If the first argument is a
   [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md), this argument is optional. The options inherit from the
   native [`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) interface, with the following
   additional properties:

   - **method**: `string`

     The HTTP method to use for the request.

   - **baseURL**: `string | undefined`

     The base URL for the request. If provided, it will have preference over the default base URL of the fetch instance.

   - **searchParams**: `HttpSearchParamsSchema.Loose | undefined`

     The search parameters to be sent with the request. If provided, it will have preference over the default search
     parameters of the fetch instance.

   - **duplex**: `'half' | undefined`

     The duplex mode for the request. If set to `'half'`, the request body will be streamed. See
     [Request streaming](/docs/zimic-fetch/guides/4-bodies.md#request-streaming) for more details.

**Related**:

- [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md)

## `fetch.isRequest`

A type guard that checks if a request is a [`FetchRequest`](/docs/zimic-fetch/api/3-fetch-request.md), was created by
the fetch instance, and has a specific method and path. This is useful to narrow down the type of a request before using
it.

```ts
fetch.isRequest(request, method, path);
```

**Arguments**:

1. **request**: `unknown`

   The request to check.

2. **method**: `string`

   The method to check.

3. **path**: `string`

   The path to check.

**Returns**: `boolean`

`true` if the request was created by the fetch instance and has the specified method and path; `false` otherwise.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
        body: { username: string };
      };
      response: {
        201: { body: User };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

// highlight-start
const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});
// highlight-end

if (fetch.isRequest(request, 'POST', '/users')) {
  // request is a FetchRequest<Schema, 'POST', '/users'>

  const contentType = request.headers.get('content-type'); // 'application/json'
  const body = await request.json(); // { username: string }
}
```

## `fetch.isResponse`

A type guard that checks if a response is a [`FetchResponse`](/docs/zimic-fetch/api/4-fetch-response.md), was received
by the fetch instance, and has a specific method and path. This is useful to narrow down the type of a response before
using it.

```ts
fetch.isResponse(response, method, path);
```

**Arguments**:

1. **response**: `unknown`

   The response to check.

2. **method**: `string`

   The method to check.

3. **path**: `string`

   The path to check.

**Returns**: `boolean`

`true` if the response was received by the fetch instance and has the specified method and path; `false` otherwise.

**Example**:

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { query?: string };
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'u' },
});

//  highlight-next-line
if (fetch.isResponse(response, 'GET', '/users')) {
  // response is a FetchResponse<Schema, 'GET', '/users'>

  const users = await response.json(); // User[]
}
```

## `fetch.isResponseError`

A type guard that checks if an error is a [`FetchResponseError`](/docs/zimic-fetch/api/4-fetch-response.md) related to a
[`FetchResponse`](/docs/zimic-fetch/api/4-fetch-response.md) received by the fetch instance with a specific method and
path. This is useful to narrow down the type of an error before handling it.

```ts
fetch.isResponseError(error, method, path);
```

**Arguments**:

1. **error**: `unknown`

   The error to check.

2. **method**: `string`

   The method to check.

3. **path**: `string`

   The path to check.

**Returns**: `boolean`

`true` if the error is a response error received by the fetch instance and has the specified method and path; `false`
otherwise.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { query?: string };
      };
      response: {
        200: { body: User[] };
        400: { body: { message: string } };
        500: { body: { message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

try {
  const response = await fetch('/users', {
    method: 'GET',
    searchParams: { query: 'u' },
  });

  if (!response.ok) {
    throw response.error; // FetchResponseError<Schema, 'GET', '/users'>
  }
} catch (error) {
  //  highlight-next-line
  if (fetch.isResponseError(error, 'GET', '/users')) {
    // error is a FetchResponseError<Schema, 'GET', '/users'>

    const status = error.response.status; // 400 | 500
    const { message } = await error.response.json(); // { message: string }

    console.error('Could not fetch users:', { status, message });
  }
}
```

**Related**:

- [Guides - Handling errors](/docs/zimic-fetch/guides/6-errors.md)
