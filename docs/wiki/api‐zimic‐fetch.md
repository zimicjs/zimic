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

    GET: {
      request: {
        searchParams: {
          query?: string;
          page?: number;
          limit?: number;
        };
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
import { type HttpSchema } from '@zimic/http';
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

const response = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'my' },
});

if (response.status === 404) {
  return null; // User not found
}

if (!response.ok) {
  throw response.error;
}

const users = await response.json();
return users; // User[]
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
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface Post {
  id: string;
  title: string;
}

type Schema = HttpSchema<{
  '/posts': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
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

// Set the authorization header for all requests
const { accessToken } = await authenticate();

fetch.defaults.headers['authorization'] = `Bearer ${accessToken}`;
console.log(fetch.defaults.headers);

const response = await fetch('/posts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'My post' }),
});

const post = await response.json(); // Post
```

### `fetch.onRequest`

A listener function that is called for each request. It can modify the requests before they are sent.

```ts
import { createFetch } from '@zimic/fetch';
import { type HttpSchema } from '@zimic/http';

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

fetch.onRequest = function (request) {
  if (this.isRequest(request, 'GET', '/users')) {
    const url = new URL(request.url);
    url.searchParams.append('limit', '10');

    const updatedRequest = new Request(url, request);
    return updatedRequest;
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
import { type HttpSchema } from '@zimic/http';
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

fetch.onResponse = function (response) {
  if (this.isResponse(response, 'GET', '/users')) {
    console.log(response.headers.get('content-encoding'));
  }
  return response;
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

#### `fetch.onResponse` return

The response to be returned. It can be the original response or a modified version of it.

### `fetch.isRequest`

A type guard that checks if a request is a [`FetchRequest`](#fetchrequest), was created by the fetch instance, and has a
specific method and path. This is useful to narrow down the type of a request before using it.

```ts
import { type HttpSchema } from '@zimic/http';
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

const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'my-user' }),
});

if (fetch.isRequest(request, 'POST', '/users')) {
  // request is a FetchRequest<Schema, 'POST', '/users'>
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
import { type HttpSchema } from '@zimic/http';
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
  searchParams: { query: 'my' },
});

if (fetch.isResponse(response, 'GET', '/users')) {
  // response is a FetchResponse<Schema, 'GET', '/users'>
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
import { type HttpSchema } from '@zimic/http';
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
    searchParams: { query: 'my' },
  });

  if (!response.ok) {
    throw response.error; // FetchResponseError<Schema, 'GET', '/users'>
  }
} catch (error) {
  if (fetch.isResponseError(error, 'GET', '/users')) {
    // error is a FetchResponseError<Schema, 'GET', '/users'>

    const status = error.response.status; // 400 | 500
    const { message } = await error.response.json(); // { message: string }

    console.error('Could not fetch users:', { status, message });
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
import { type HttpSchema } from '@zimic/http';
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

const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'my-user' }),
});
console.log(request); // FetchRequest<Schema, 'POST', '/users'>
```

**See also:**

- [Request](https://developer.mozilla.org/docs/Web/API/Request)

## `FetchResponse`

A response instance typed with an HTTP schema, closely compatible with the
[native Response class](https://developer.mozilla.org/docs/Web/API/Response).

On top of the properties available in native Response instances, fetch responses have a reference to the request that
originated them, available in the `request` property.

If the response has a failure status code (4XX or 5XX), an error is available in the `error` property.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: { body: User };
        404: { body: { message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

console.log(response); // FetchResponse<Schema, 'GET', '/users'>

if (response.status === 404) {
  const errorBody = await response.json(); // { message: string }
  console.error(errorBody.message);
  return null;
} else {
  const user = await response.json(); // User
  return user;
}
```

**See also:**

- [Response](https://developer.mozilla.org/docs/Web/API/Response)

## `FetchResponseError`

An error that is thrown when a fetch request fails with a failure status code (4XX or 5XX).

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: { body: User };
        404: { body: { message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (!response.ok) {
  console.log(response.status); // 404

  console.log(response.error); // FetchResponseError<Schema, 'GET', '/users'>
  console.log(response.error.request); // FetchRequest<Schema, 'GET', '/users'>
  console.log(response.error.response); // FetchResponse<Schema, 'GET', '/users'>
}
```

## Guides

### Using headers

You can set headers for individual `fetch` requests by using the `headers` option.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        headers: { 'accept-language'?: string };
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

// The 'accept-language' header for this request is set to 'fr'.
const response = await fetch('/users', {
  method: 'GET',
  headers: { 'accept-language': 'fr' },
});

const users = await response.json(); // User[]
```

If you'd like to set default headers for all requests, you can use [`fetch.defaults`](#fetchdefaults), either when
creating the fetch instance or at runtime.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

type Schema = HttpSchema<{
  // ...
}>;

// Set default headers for all requests on creation
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  headers: { 'accept-language': 'en' },
});

// Set default headers for all requests at runtime
const { accessToken } = await authenticate();

fetch.defaults.headers['authorization'] = `Bearer ${token}`;
```

[`fetch.onRequest`](#fetchonrequest) can also be used to set headers for all of your requests or a subset of them.

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
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: {
          limit?: `${number}`;
          orderBy?: 'createdAt:asc' | 'createdAt:desc';
        };
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

// The search params for this request are set to 'limit=10&orderBy=createdAt:desc'.
const response = await fetch('/users', {
  method: 'GET',
  searchParams: { limit: '10', orderBy: 'createdAt:desc' },
});
```

If you'd like to set default search params for all requests, you can use [`fetch.defaults`](#fetchdefaults), either when
creating the fetch instance or at runtime.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

type Schema = HttpSchema<{
  // ...
}>;

// Set default search params for all requests on creation
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  searchParams: { limit: '10' },
});

// Set default search params for all requests at runtime
fetch.defaults.searchParams.orderBy = 'createdAt:desc';
console.log(fetch.defaults.searchParams);
```

[`fetch.onRequest`](#fetchonrequest) can also be used to set search params for all of your requests or a subset of them.

```ts
fetch.onRequest = function (request) {
  if (this.isRequest(request, 'GET', '/users')) {
    const url = new URL(request.url);
    url.searchParams.append('limit', '10');

    const updatedRequest = new Request(url, request);
    return updatedRequest;
  }

  return request;
};
```

### Using bodies

#### Using a JSON body

To send a JSON body in a request, use the header `'content-type': 'application/json'` and pass the stringified JSON
object in the `body` option.

```ts
import { type HttpSchema } from '@zimic/http';
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

const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'my-user' }),
});

const user = await response.json(); // User
```

#### Using a `FormData` body

To send a `FormData` body in a request, use the header `'content-type': 'multipart/form-data'` and pass the
[`HttpFormData`](api‐zimic‐http#httpformdata) object in the `body` option.

The HTTP schema should define the body as a `HttpFormData<FormDataSchema>` object, where `FormDataSchema` is a type
representing the form data fields.

```ts
import { HttpFormData, type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

type AvatarFormDataSchema = HttpSchema.FormData<{
  image: File;
}>;

type Schema = HttpSchema<{
  '/users/:userId/avatar': {
    PUT: {
      request: {
        headers: { 'content-type': 'multipart/form-data' };
        body: HttpFormData<AvatarFormDataSchema>;
      };
      response: {
        200: { body: { url: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const formData = new HttpFormData<AvatarFormDataSchema>();

const imageInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const imageFile = imageInput!.files![0];
formData.append('image', imageFile);

const response = await fetch(`/users/${userId}/avatar`, {
  method: 'PUT',
  headers: { 'content-type': 'multipart/form-data' },
  body: formData,
});

const result = await response.json(); // { url: string }
```

#### Using a file or binary body

To send a file or binary body in a request, use the header `'content-type': 'application/octet-stream'` and pass the
`File`, `Blob` or `ArrayBuffer` in the `body` option.

```ts
import fs from 'fs';
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface Video {
  id: string;
  url: string;
}

type Schema = HttpSchema<{
  '/upload/mp4': {
    POST: {
      request: {
        headers: { 'content-type': 'video/mp4' };
        body: Blob;
      };
    };
    response: {
      201: { body: Video };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const videoBuffer = await fs.promises.readFile('video.mp4');
const videoFile = new File([videoBuffer], 'video.mp4');

const response = await fetch('/upload/mp4', {
  method: 'POST',
  headers: { 'content-type': 'video/mp4' },
  body: videoFile,
});

const video = await response.json(); // Video
```

### Handling authentication

To manage authenticated clients, you can use [`fetch.defaults`](#fetchdefaults) to set the necessary headers for your
requests.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        headers?: { authorization?: string };
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

// Authenticate to your service
const { accessToken } = await authenticate();

// Set the authorization header for all requests
fetch.defaults.headers['authorization'] = `Bearer ${token}`;

const request = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'my' },
});

const users = await request.json(); // User[]
```

Alternatively, you can use [`fetch.onRequest`](#fetchonrequest) to manually set headers in all of your requests or a
subset of them.

### Handling errors

`@zimic/fetch` fully types the responses and errors of your requests based on your HTTP schema. If the response has a
failure status code (4XX or 5XX), the `response.ok` property is `false` and throw the `response.error` property, which
is a `FetchResponseError` and can be handled upper in the call stack. If you want to handle the error in the same place
as the request, you can check the `response.status` or the `response.ok` properties.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      request: {
        headers?: { authorization?: string };
      };
      response: {
        200: { body: User };
        401: { body: { code: 'UNAUTHORIZED'; message: string } };
        403: { body: { code: 'FORBIDDEN'; message: string } };
        404: { body: { code: 'NOT_FOUND'; message: string } };
        500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
        503: { body: { code: 'SERVICE_UNAVAILABLE'; message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (response.status === 404) {
  return null; // User not found
}

if (response.status === 401 || response.status === 403) {
  const data = await response.json(); // { code: 'UNAUTHORIZED' | 'FORBIDDEN'; message: string }
  console.error('Authentication error:', data);
}

if (!response.ok) {
  throw response.error;
}

const user = await response.json(); // User
return user;
```
