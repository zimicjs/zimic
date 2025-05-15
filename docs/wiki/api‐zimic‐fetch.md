# `@zimic/fetch` - API reference <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`createFetch`](#createfetch)
  - [`createFetch` arguments](#createfetch-arguments)
- [`fetch`](#fetch)
  - [`fetch` arguments](#fetch-arguments)
  - [`fetch` return](#fetch-return)
- [`fetch.defaults`](#fetchdefaults)
- [`fetch.loose`](#fetchloose)
- [`fetch.Request`](#fetchrequest)
- [`fetch.onRequest`](#fetchonrequest)
  - [`fetch.onRequest` arguments](#fetchonrequest-arguments)
  - [`fetch.onRequest` return](#fetchonrequest-return)
- [`fetch.onResponse`](#fetchonresponse)
  - [`fetch.onResponse` arguments](#fetchonresponse-arguments)
  - [`fetch.onResponse` return](#fetchonresponse-return)
- [`fetch.isRequest`](#fetchisrequest)
  - [`fetch.isRequest` arguments](#fetchisrequest-arguments)
  - [`fetch.isRequest` return](#fetchisrequest-return)
- [`fetch.isResponse`](#fetchisresponse)
  - [`fetch.isResponse` arguments](#fetchisresponse-arguments)
  - [`fetch.isResponse` return](#fetchisresponse-return)
- [`fetch.isResponseError`](#fetchisresponseerror)
  - [`fetch.isResponseError` arguments](#fetchisresponseerror-arguments)
  - [`fetch.isResponseError` return](#fetchisresponseerror-return)
- [`FetchRequest`](#fetchrequest-1)
- [`FetchResponse`](#fetchresponse)
- [`FetchResponseError`](#fetchresponseerror)
  - [`FetchResponseError#toObject`](#fetchresponseerrortoobject)
    - [`FetchResponseError#toObject` arguments](#fetchresponseerrortoobject-arguments)
    - [`FetchResponseError#toObject` return](#fetchresponseerrortoobject-return)
- [Guides](#guides)
  - [Using headers](#using-headers)
  - [Using search params (query)](#using-search-params-query)
  - [Using bodies](#using-bodies)
    - [Using a JSON body](#using-a-json-body)
    - [Using a `FormData` body](#using-a-formdata-body)
    - [Using a file or binary body](#using-a-file-or-binary-body)
  - [Handling authentication](#handling-authentication)
  - [Handling errors](#handling-errors)
    - [Handling errors: Logging](#handling-errors-logging)

---

`@zimic/fetch` is a minimal (~2 kB minified and gzipped), zero-dependency, and type-safe `fetch`-like API client.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

## `createFetch`

Creates a [`fetch`](#fetch) instance typed with an HTTP schema, closely compatible with the
[native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API). All requests and responses are typed by
default with the schema, including methods, paths, status codes, arguments, and bodies.

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

### `createFetch` arguments

| Argument  | Type                      | Description                         |
| --------- | ------------------------- | ----------------------------------- |
| `options` | `FetchOptions` (required) | The options for the fetch instance. |

`options` is an object inheriting the native
[`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) options, plus the following properties
specific to `@zimic/fetch`:

| Option         | Type                                                                                                | Description                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `baseURL`      | `string` (required)                                                                                 | The base URL to prefix all requests with.                                                            |
| `searchParams` | `HttpSearchParamsInit` (optional)                                                                   | The default search params to append to all requests.                                                 |
| `onRequest`    | `(request: FetchRequest.Loose) => Promise<FetchRequest.Loose> \| FetchRequest.Loose` (optional)     | A listener to be called before the request is sent (see [`fetch.onRequest`](#fetchonrequest)).       |
| `onResponse`   | `(response: FetchResponse.Loose) => Promise<FetchResponse.Loose> \| FetchResponse.Loose` (optional) | A listener to be called after the response is received (see [`fetch.onResponse`](#fetchonresponse)). |

## `fetch`

The result of [`createFetch`](#createfetch) is a fetch instance typed with an HTTP schema, closely compatible with the
[native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API).

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
  searchParams: { query: 'u' },
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

### `fetch` arguments

`fetch(input, init)`

| Argument | Type                                                            | Description                                                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`  | `string` \| `URL` \| [`FetchRequest`](#fetchrequest) (required) | The resource to fetch, either a path, a URL, or a [`FetchRequest`](#fetchrequest) request. If a path is provided, it is automatically prefixed with the base URL of the fetch instance when the request is sent. If a URL or a request is provided, it is used as is. |
| `init`   | `FetchRequestInit` (required \| optional)                       | The request options. If a path or a URL is provided as the first argument, this argument is required and should contain at least the method of the request. If the first argument is a [`FetchRequest`](#fetchrequest) request, this argument is optional.            |

**See also**:

- [Request](https://developer.mozilla.org/docs/Web/API/Request)
- [RequestInit](https://developer.mozilla.org/docs/Web/API/RequestInit)

### `fetch` return

A promise that resolves to the response to the request. The response is typed with the schema of the fetch instance.

**See also**:

- [Response](https://developer.mozilla.org/docs/Web/API/Response)

## `fetch.defaults`

The default options for each request sent by the fetch instance. All of the native
[`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) options are supported, plus `baseURL` and
`searchParams` as in [`createFetch(options)`](#createfetch).

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

fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
console.log(fetch.defaults.headers);

const response = await fetch('/posts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'My post' }),
});

const post = await response.json(); // Post
```

## `fetch.loose`

A loosely-typed version of [`fetch`](#fetch). This can be useful to make requests with fewer type constraints, such as
in [`onRequest`](#fetchonrequest) and [`onResponse`](#fetchonresponse) listeners.

See [Guides: Handling authentication](#handling-authentication) for an example.

## `fetch.Request`

A constructor for creating [`FetchRequest`](#fetchrequest-1), closely compatible with the native
[Request](https://developer.mozilla.org/docs/Web/API/Request) constructor.

See [`FetchRequest`](#fetchrequest-1) for more information.

## `fetch.onRequest`

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

  onRequest(request) {
    if (this.isRequest(request, 'GET', '/users')) {
      const url = new URL(request.url);
      url.searchParams.append('limit', '10');

      const updatedRequest = new Request(url, request);
      return updatedRequest;
    }

    return request;
  },
});
```

### `fetch.onRequest` arguments

`fetch.onRequest(request)`

| Argument  | Type                                             | Description                                   |
| --------- | ------------------------------------------------ | --------------------------------------------- |
| `request` | [`FetchRequest.Loose`](#fetchrequest) (required) | The request to be sent by the fetch instance. |

Inside the listener, use `this` to refer to the fetch instance that is sending the request.

### `fetch.onRequest` return

The request to be sent. It can be the original request or a modified version of it.

## `fetch.onResponse`

A listener function that is called after each response is received. It can modify the responses before they are returned
to the caller.

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

  onResponse(response) {
    if (this.isResponse(response, 'GET', '/users')) {
      console.log(response.headers.get('content-encoding'));
    }
    return response;
  },
});
```

### `fetch.onResponse` arguments

`fetch.onResponse(response)`

| Argument   | Type                                               | Description                                  |
| ---------- | -------------------------------------------------- | -------------------------------------------- |
| `response` | [`FetchResponse.Loose`](#fetchresponse) (required) | The response received by the fetch instance. |

Inside the listener, use `this` to refer to the fetch instance that received the response.

### `fetch.onResponse` return

The response to be returned. It can be the original response or a modified version of it.

## `fetch.isRequest`

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
  body: JSON.stringify({ username: 'me' }),
});

if (fetch.isRequest(request, 'POST', '/users')) {
  // request is a FetchRequest<Schema, 'POST', '/users'>

  const contentType = request.headers.get('content-type'); // 'application/json'
  const body = await request.json(); // { username: string }
}
```

**See also**:

- [`fetch.onRequest`](#fetchonrequest)
- [`fetch.onResponse`](#fetchonresponse)
- [Guides: Handling errors](#handling-errors)

### `fetch.isRequest` arguments

`fetch.isRequest(request, method, path)`

| Argument  | Type                    | Description           |
| --------- | ----------------------- | --------------------- |
| `request` | `unknown` (required)    | The request to check. |
| `method`  | `HttpMethod` (required) | The method to check.  |
| `path`    | `string` (required)     | The path to check.    |

### `fetch.isRequest` return

Returns `true` if the request was created by this fetch instance and has the specified method and path; `false`
otherwise.

## `fetch.isResponse`

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
  searchParams: { query: 'u' },
});

if (fetch.isResponse(response, 'GET', '/users')) {
  // response is a FetchResponse<Schema, 'GET', '/users'>

  const users = await response.json(); // User[]
}
```

**See also**:

- [`fetch.onRequest`](#fetchonrequest)
- [`fetch.onResponse`](#fetchonresponse)
- [Guides: Handling errors](#handling-errors)

### `fetch.isResponse` arguments

`fetch.isResponse(response, method, path)`

| Argument   | Type                    | Description            |
| ---------- | ----------------------- | ---------------------- |
| `response` | `unknown` (required)    | The response to check. |
| `method`   | `HttpMethod` (required) | The method to check.   |
| `path`     | `string` (required)     | The path to check.     |

### `fetch.isResponse` return

Returns `true` if the response was received by this fetch instance and has the specified method and path; `false`
otherwise.

## `fetch.isResponseError`

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
    searchParams: { query: 'u' },
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

**See also**:

- [`fetch.onRequest`](#fetchonrequest)
- [`fetch.onResponse`](#fetchonresponse)
- [Guides: Handling errors](#handling-errors)

### `fetch.isResponseError` arguments

`fetch.isResponseError(error, method, path)`

| Argument | Type                    | Description          |
| -------- | ----------------------- | -------------------- |
| `error`  | `unknown` (required)    | The error to check.  |
| `method` | `HttpMethod` (required) | The method to check. |
| `path`   | `string` (required)     | The path to check.   |

### `fetch.isResponseError` return

Returns `true` if the error is a response error received by the fetch instance and has the specified method and path;
`false` otherwise.

## `FetchRequest`

A request instance typed with an HTTP schema, closely compatible with the
[native Request class](https://developer.mozilla.org/docs/Web/API/Request).

On top of the properties available in native Request instances, fetch requests have their URL automatically prefixed
with the base URL of their fetch instance. [Default options](#fetchdefaults) are also applied, if present in the fetch
instance.

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
  body: JSON.stringify({ username: 'me' }),
});

console.log(request); // FetchRequest<Schema, 'POST', '/users'>
console.log(request.path); // '/users'
```

**See also**:

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
console.log(response.path); // '/users'

if (response.status === 404) {
  console.log(response.error); // FetchResponseError<Schema, 'GET', '/users/:userId'>

  const errorBody = await response.json(); // { message: string }
  console.error(errorBody.message);

  return null;
} else {
  const user = await response.json(); // User
  return user;
}
```

**See also**:

- [Response](https://developer.mozilla.org/docs/Web/API/Response)

## `FetchResponseError`

An error representing a response with a failure status code (4XX or 5XX).

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

### `FetchResponseError#toObject`

The method `fetchResponseError.toObject()` returns a plain object representation of the error. It is useful for
serialization, debugging, and logging purposes.

```ts
const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (!response.ok) {
  const plainError = response.error.toObject();
  console.log(JSON.stringify(plainError));
  // {"name":"FetchResponseError","message":"...","request":{...},"response":{...}}
}
```

#### `FetchResponseError#toObject` arguments

`fetchResponseError.toObject(options?)`

| Argument  | Type                                         | Description                                               |
| --------- | -------------------------------------------- | --------------------------------------------------------- |
| `options` | `FetchResponseErrorObjectOptions` (optional) | The options for converting the error into a plain object. |

`options` is an object supporting the following properties:

| Option                | Type                                  | Description                                                      |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `includeRequestBody`  | `boolean` (optional, default `false`) | Whether to include the body of the request in the plain object.  |
| `includeResponseBody` | `boolean` (optional, default `false`) | Whether to include the body of the response in the plain object. |

> [!NOTE]
>
> When using `options.includeRequestBody: true` or `options.includeResponseBody: true`, you can only call `toObject()`
> if the bodies of the request or response have not been consumed yet, respectively. In case you access their bodies
> before or after calling `toObject()`, consider using
> [`request.clone()`](https://developer.mozilla.org/docs/Web/API/Request/clone) and
> [`response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone).

```ts
const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

// Clone the response before reading the body
const body = await response.clone().json();
console.log(body);

if (!response.ok) {
  // `toObject()` can include the response body because it was only consumed from the clone
  const plainError = await response.error.toObject({
    includeResponseBody: true,
  });
  console.log(plainError);
}
```

#### `FetchResponseError#toObject` return

A plain object representing this error. If `options.includeRequestBody` or `options.includeResponseBody` is `true`, the
body of the request and response will be included, respectively, and the return is a `Promise`. Otherwise, the return is
the plain object itself without the bodies.

## Guides

### Using headers

See https://zimic.dev/docs/fetch/guides/headers.

### Using search params (query)

See https://zimic.dev/docs/fetch/guides/search-params.

### Using bodies

#### Using a JSON body

To send a JSON body in a request, use the header `'content-type': 'application/json'` and pass the stringified JSON
object in the `body` option.

The HTTP schema should define a `content-type` header and a JSON body for the request.

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
  body: JSON.stringify({ username: 'me' }),
});

const user = await response.json(); // User
```

#### Using a `FormData` body

To send a `FormData` body in a request, use the header `'content-type': 'multipart/form-data'` and pass the
[`HttpFormData`](api‐zimic‐http#httpformdata) object in the `body` option.

The HTTP schema may have a `content-type` header and should define the body as a `HttpFormData<FormDataSchema>` object,
where `FormDataSchema` is a type representing the form data fields.

Depending on your runtime, the `content-type` header may be set automatically when using a `FormData` body. In that
case, you are not required to set the header manually.

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

The HTTP schema should define a `content-type` header and a binary body for the request.

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

To manage authenticated clients, you can use [`fetch.defaults`](#fetchdefaults) and/or
[`fetch.onRequest`](#fetchonrequest) to set the necessary headers for your requests.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/auth/login': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
        body: { username: string; password: string };
      };
      response: {
        201: { body: { accessToken: string } };
      };
    };
  };

  '/auth/refresh': {
    POST: {
      response: {
        201: { body: { accessToken: string } };
      };
    };
  };

  '/users': {
    GET: {
      request: {
        headers: { authorization: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message: string } };
        403: { body: { message: string } };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL,

  async onResponse(response) {
    if (response.status === 401) {
      const body = await response.clone().json();

      if (body.message === 'Access token expired') {
        // Refresh the access token
        const refreshResponse = await this('/auth/refresh', { method: 'POST' });
        const { accessToken } = await refreshResponse.json();

        // Clone the original request and update its headers
        const updatedRequest = response.request.clone();
        updatedRequest.headers.set('authorization', `Bearer ${accessToken}`);

        // Retry the original request with the updated headers
        return this.loose(updatedRequest);
      }
    }

    return response;
  },
});

// Authenticate to your service before requests
const loginRequest = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me', password: 'password' }),
});
const { accessToken } = await loginRequest.json();

// Set the authorization header for all requests
fetch.defaults.headers.authorization = `Bearer ${accessToken}`;

const request = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'u' },
});

const users = await request.json(); // User[]
```

### Handling errors

`@zimic/fetch` fully types the responses of your requests based on your HTTP schema. If the response has a failure
status code (4XX or 5XX), the `response.ok` property is `false` and you can throw the `response.error` property, which
is will be `FetchResponseError` to be handled upper in the call stack. If you want to handle the error as soon as the
response is received, you can check the `response.status` or the `response.ok` properties.

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
  const body = await response.json(); // { code: 'UNAUTHORIZED' | 'FORBIDDEN'; message: string }
  console.error('Authentication error:', body);
}

if (!response.ok) {
  // Throw other errors
  throw response.error;
}

const user = await response.json(); // User
```

#### Handling errors: Logging

When logging fetch response errors (e.g. in a global handler), consider using
[`fetchResponseError.toObject()`](#fetchresponseerrortoobject) to get a plain object representation serializable to
JSON.

```ts
if (error instanceof FetchResponseError) {
  const plainError = error.toObject();
  console.error(plainError);
}
```

You can also use `JSON.stringify` or a logging library to serialize the error.

```ts
if (error instanceof FetchResponseError) {
  const plainError = error.toObject();
  console.error(JSON.stringify(plainError)); // Log in a single line
}
```

Request and response bodies are not included by default. If you want to include them, use
[`includeRequestBody`](#fetchresponseerrortoobject-arguments) and
[`includeResponseBody`](#fetchresponseerrortoobject-arguments). Note that the result will be a `Promise`.

```ts
if (error instanceof FetchResponseError) {
  const plainError = await error.toObject({
    includeRequestBody: true,
    includeResponseBody: true,
  });
  console.error(JSON.stringify(plainError));
}
```

If you are working with form data or blob bodies, such as file uploads or downloads, logging the body may not be useful
as binary data won't be human-readable. To handle this, you can check the content type of the request and response and
include the body conditionally.

```ts
if (error instanceof FetchResponseError) {
  const plainError = await error.toObject({
    // Include the body only if the content type is JSON
    includeRequestBody: error.request.headers.get('content-type') === 'application/json',
    includeResponseBody: error.response.headers.get('content-type') === 'application/json',
  });
  console.error(JSON.stringify(plainError));
}
```
