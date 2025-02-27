# API reference: `@zimic/fetch` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`createFetch(options)`](#createfetchoptions)
  - [`createFetch` parameters](#createfetch-parameters)
- [`fetch`](#fetch)
  - [`fetch` parameters](#fetch-parameters)
  - [`fetch` return](#fetch-return)
  - [`fetch.defaults`](#fetchdefaults)
  - [`fetch.onRequest`](#fetchonrequest)
    - [`fetch.onRequest` parameters](#fetchonrequest-parameters)
    - [`fetch.onRequest` return](#fetchonrequest-return)
  - [`fetch.onResponse`](#fetchonresponse)
    - [`fetch.onResponse` parameters](#fetchonresponse-parameters)
    - [`fetch.onResponse` return](#fetchonresponse-return)
  - [`fetch.isRequest`](#fetchisrequest)
    - [`fetch.isRequest` parameters](#fetchisrequest-parameters)
    - [`fetch.isRequest` return](#fetchisrequest-return)
  - [`fetch.isResponse`](#fetchisresponse)
    - [`fetch.isResponse` parameters](#fetchisresponse-parameters)
    - [`fetch.isResponse` return](#fetchisresponse-return)
  - [`fetch.isResponseError`](#fetchisresponseerror)
    - [`fetch.isResponseError` parameters](#fetchisresponseerror-parameters)
    - [`fetch.isResponseError` return](#fetchisresponseerror-return)
- [`FetchRequest`](#fetchrequest)
- [`FetchResponse`](#fetchresponse)
- [`FetchResponseError`](#fetchresponseerror)
- [Guides](#guides)
  - [Using headers](#using-headers)
  - [Using search params (query)](#using-search-params-query)
  - [Using bodies](#using-bodies)
    - [Using a JSON body](#using-a-json-body)
    - [Using a `FormData` body](#using-a-formdata-body)
    - [Using a file or binary body](#using-a-file-or-binary-body)
  - [Handling authentication](#handling-authentication)
  - [Handling errors](#handling-errors)

---

`@zimic/fetch` is a minimal (1 kB minified and gzipped), zero-dependency, and type-safe `fetch` -like API client.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

## `createFetch(options)`

Creates a [`fetch`](#fetch) instance typed with an HTTP schema, closely compatible with the
[native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API). All requests and responses are typed by
default with the schema, including methods, paths, status codes, parameters, and bodies.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  username: string;
}

type MySchema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: User };
      response: { 201: { body: User } };
    };

    GET: {
      request: {
        searchParams: { username?: string; limit?: `${number}` };
      };
      response: { 200: { body: User[] } };
    };
  };
}>;

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});
```

### `createFetch` parameters

- `options`: The options for the fetch instance.
  - `baseURL`: The base URL to prefix all requests with.
  - `onRequest`: A listener to be called before the request is sent (see [`fetch.onRequest`](#fetchonrequest)).
  - `onResponse`: A listener to be called after the response is received (see [`fetch.onResponse`](#fetchonresponse)).
  - `body`: A BodyInit object or null (see [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#body)).
  - `cache`: A string indicating how the request will interact with the browser's cache (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#cache)).
  - `credentials`: A string indicating whether credentials will be sent with the request (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#credentials)).
  - `headers`: A Headers object, an object literal, or array of two-item arrays for request headers (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#headers)).
  - `integrity`: A cryptographic hash of the resource to be fetched (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#integrity)).
  - `keepalive`: A boolean to set request's keepalive (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#keepalive)).
  - `method`: A string to set request's method (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#method)).
  - `mode`: A string to indicate whether the request will use CORS (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#mode)).
  - `priority`: Request priority level (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#priority)).
  - `redirect`: A string indicating how redirects should be handled (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#redirect)).
  - `referrer`: A string for the request's referrer URL (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#referrer)).
  - `referrerPolicy`: A referrer policy for the request (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#referrerPolicy)).
  - `signal`: An AbortSignal to control request cancellation (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#signal)).
  - `window`: Can only be null. Used to disassociate request from any Window (see
    [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit#window)).

## `fetch`

The result of [`createFetch`](#createfetchoptions) is a fetch instance typed with an HTTP schema, closely compatible
with the [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API).

Requests sent by the fetch instance have their URL automatically prefixed with the base URL of the instance.
[Default options](#fetchdefaults) are also applied to the requests, if provided.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

const response = await fetch('/users', {
  method: 'GET',
  searchParams: { username: 'my', limit: '10' },
});

if (response.status === 404) {
  return null; // User not found
}

if (!response.ok) {
  throw response.error;
}

const users = await response.json();
return users; // [{ username: 'my-user' }]
```

### `fetch` parameters

`fetch(input, init?)`

- `input`: The resource to fetch, either a path, a URL, or a [`FetchRequest`](#fetchrequest) request. If a path is
  provided, it is automatically prefixed with the base URL of the fetch instance when the request is sent. If a URL or a
  request is provided, it is used as is.
- `init`: The request options. If a path or a URL is provided as the first argument, this argument is required and
  should contain at least the method of the request. If the first argument is a [`FetchRequest`](#fetchrequest) request,
  this argument is optional.

**See also:**

- [Request](https://developer.mozilla.org/docs/Web/API/Request)
- [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit)

### `fetch` return

A promise that resolves to the response to the request. The response is typed with the schema of the fetch instance.

**See also:**

- [Response](https://developer.mozilla.org/docs/Web/API/Response)

### `fetch.defaults`

The default options for each request sent by the fetch instance. The available options are the same as the
[`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) options, plus `baseURL`.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

// Set the authorization header for all requests
const token = await getToken();

fetch.defaults.headers['authorization'] = `Bearer ${token}`;
console.log(fetch.defaults.headers);

const response = await fetch('/posts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'My post' }),
});
```

### `fetch.onRequest`

A listener function that is called for each request. It can modify the requests before they are sent.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

fetch.onRequest = function (request) {
  if (this.isRequest(request, 'GET', '/users')) {
    request.searchParams.set('limit', '10');
  }
  return request;
};
```

> [!TIP]
>
> Alternatively, `onRequest` can be provided as an option when creating the fetch instance with
> [`createFetch`](#createfetchoptions).

#### `fetch.onRequest` parameters

`fetch.onRequest(request)`

- `request`: The original request.

Inside the listener, use `this` to refer to the fetch instance that is sending the request.

#### `fetch.onRequest` return

The request to be sent. It can be the original request or a modified version of it.

### `fetch.onResponse`

A listener function that is called after each response is received. It can modify the responses before they are returned
to the fetch caller.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

fetch.onResponse = function (response) {
  const updatedHeaders = new Headers(response.headers);
  updatedHeaders.set('content-language', 'en');

  const updatedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: updatedHeaders,
  });

  return updatedResponse;
};
```

> [!TIP]
>
> Alternatively, `onResponse` can be provided as an option when creating the fetch instance with
> [`createFetch`](#createfetchoptions).

#### `fetch.onResponse` parameters

`fetch.onResponse(response)`

- `response`: The original response.

Inside the listener, use `this` to refer to the fetch instance that received the response.

```ts
fetch.onResponse = function (response) {
  if (this.isResponse(response, 'GET', '/users')) {
    console.log(response.headers.get('content-type'));
  }
  return response;
};
```

#### `fetch.onResponse` return

The response to be returned. It can be the original response or a modified version of it.

### `fetch.isRequest`

A type guard that checks if a request is a [`FetchRequest`](#fetchrequest), was created by the fetch instance, and has a
specific method and path. This is useful to narrow down the type of a request before using it.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

const request = new fetch.Request('POST', '/users', {
  body: JSON.stringify({ username: 'my-user' }),
});

if (fetch.isRequest(request, 'POST', '/users')) {
  // request is a FetchRequest<MySchema, 'POST', '/users'>
}
```

#### `fetch.isRequest` parameters

`fetch.isRequest(request, method, path)`

- `request`: The request to check.
- `method`: The method to check.
- `path`: The path to check.

#### `fetch.isRequest` return

Returns `true` if the request was created by this fetch instance and has the specified method and path; `false`
otherwise.

### `fetch.isResponse`

A type guard that checks if a response is a [`FetchResponse`](#fetchresponse), was received by the fetch instance, and
has a specific method and path. This is useful to narrow down the type of a response before using it.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  searchParams: { username: 'my', limit: '10' },
});

if (fetch.isResponse(response, 'GET', '/users')) {
  // response is a FetchResponse<MySchema, 'GET', '/users'>
}
```

#### `fetch.isResponse` parameters

`fetch.isResponse(response, method, path)`

- `response`: The response to check.
- `method`: The method to check.
- `path`: The path to check.

#### `fetch.isResponse` return

Returns `true` if the response was received by this fetch instance and has the specified method and path; `false`
otherwise.

### `fetch.isResponseError`

A type guard that checks if an error is a `FetchResponseError` related to a `FetchResponse` response received by the
fetch instance with a specific method and path. This is useful to narrow down the type of an error before handling it.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

try {
  await fetch('/users', {
    method: 'GET',
    searchParams: { username: 'my', limit: '10' },
  });

  if (!response.ok) {
    throw response.error;
  }
} catch (error) {
  if (fetch.isResponseError(error, 'GET', '/users')) {
    // error is a FetchResponseError<MySchema, 'GET', '/users'>

    const status = error.response.status;
    const data = await error.response.json();

    console.error('Could not fetch users:', status, data);
  }
}
```

#### `fetch.isResponseError` parameters

`fetch.isResponseError(error, method, path)`

- `error`: The error to check.
- `method`: The method to check.
- `path`: The path to check.

#### `fetch.isResponseError` return

Returns `true` if the error is a response error received by the fetch instance and has the specified method and path;
`false` otherwise.

## `FetchRequest`

A request instance typed with an HTTP schema, closely compatible with the
[native Request class](https://developer.mozilla.org/docs/Web/API/Request).

On top of the properties available in native Request instances, fetch requests have their URL automatically prefixed
with the base URL of their fetch instance. Default options are also applied, if present in the fetch instance.

The path of the request is extracted from the URL, excluding the base URL, and is available in the `path` property.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

const request = new fetch.Request('POST', '/users', {
  body: JSON.stringify({ username: 'my-user' }),
});
console.log(request); // FetchRequest<MySchema, 'POST', '/users'>
```

**See also:**

- [`fetch` API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch)
- [Request](https://developer.mozilla.org/docs/Web/API/Request)

## `FetchResponse`

A response instance typed with an HTTP schema, closely compatible with the
[native Response class](https://developer.mozilla.org/docs/Web/API/Response).

On top of the properties available in native Response instances, fetch responses have a reference to the request that
originated them, available in the `request` property.

If the response has a failure status code (4XX or 5XX), an error is available in the `error` property.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  searchParams: { username: 'my', limit: '10' },
});
console.log(response); // FetchResponse<MySchema, 'GET', '/users'>
```

**See also:**

- [`fetch` API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetch)
- [Response](https://developer.mozilla.org/docs/Web/API/Response)

## `FetchResponseError`

An error that is thrown when a fetch request fails with a failure status code (4XX or 5XX).

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});

await fetch('/users', {
  method: 'GET',
  searchParams: { username: 'my', limit: '10' },
});

if (!response.ok) {
  console.log(response.error.request); // FetchRequest<MySchema, 'GET', '/users'>
  console.log(response.error.response); // FetchResponse<MySchema, 'GET', '/users'>
}
```

## Guides

### Using headers

You can set headers for individual `fetch` requests by using the `headers` option.

```ts
// The 'accept-language' header for this request is set to 'fr'.
const response = await fetch('/users', {
  method: 'GET',
  headers: { 'accept-language': 'fr' },
});
```

If you'd like to set default headers for all requests, you can use [`fetch.defaults`](#fetchdefaults), either when
creating the fetch instance or at runtime.

```ts
import { createFetch } from '@zimic/fetch';

// All requests will have the 'accept-language' header set to 'en'.
const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

// Set the authorization header for all requests
const token = await getToken();
fetch.defaults.headers['authorization'] = `Bearer ${token}`;
```

[`fetch.onRequest`](#fetchonrequest) can also be used to set headers for all of a subset of your requests.

```ts
fetch.onRequest = function (request) {
  if (this.isRequest(request, 'GET', '/users')) {
    request.headers.set('accept-language', 'en');
  }
  return request;
};
```

### Using search params (query)

You can set search params (query) for individual `fetch` requests by using the `searchParams` option.

```ts
// The search params for this request are set to 'limit=10&orderBy=createdAt:desc'.
const response = await fetch('/users', {
  method: 'GET',
  searchParams: { limit: '10', orderBy: 'createdAt:desc' },
});
```

If you'd like to set default search params for all requests, you can use [`fetch.defaults`](#fetchdefaults), either when
creating the fetch instance or at runtime.

```ts
import { createFetch } from '@zimic/fetch';

// All requests will have the search params set to 'limit=10'.
const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
  searchParams: { limit: '10' },
});

// Set the search params for all requests
fetch.defaults.searchParams['orderBy'] = 'createdAt:desc';
console.log(fetch.defaults.searchParams);
```

[`fetch.onRequest`](#fetchonrequest) can also be used to set search params for all of a subset of your requests.

```ts
fetch.onRequest = function (request) {
  if (this.isRequest(request, 'GET', '/users')) {
    request.searchParams.set('orderBy', 'createdAt:desc');
  }
  return request;
};
```

### Using bodies

#### Using a JSON body

#### Using a `FormData` body

#### Using a file or binary body

### Handling authentication

### Handling errors
