---
title: FetchResponse | @zimic/fetch
sidebar_label: FetchResponse
slug: /fetch/api/fetch-response
---

# `FetchResponse`

A type representing a typed fetch response, which inherits from the native
[Response](https://developer.mozilla.org/docs/Web/API/Response).

On top of the properties available in native responses, `FetchResponse` instances have a reference to the originating
request, accessible via the `request` property. If the response has a failure status code (4XX or 5XX), an error is
available in the `error` property.

```ts
type FetchResponse<
  Schema,
  Method,
  Path,
  ErrorOnly = false,
  Redirect = RequestRedirect
>;
```

**Type arguments**:

1. **Schema**: `HttpSchema`

   The [HTTP schema](/docs/zimic-http/guides/1-schemas.md) used for the fetch instance.

2. **Method**: `string`

   The HTTP method of the request that caused the error. Must be one of the methods of the path defined in the schema.

3. **Path**: `string`

   The path of the request that caused the error. Must be one of the paths defined in the schema.

4. **ErrorOnly**: `boolean`

   If `true`, the response will only include the status codes that are considered errors (4XX or 5XX).

5. **Redirect**: `RequestRedirect`

   The redirect mode for the request, which can be one of `'follow'`, `'error'`, or `'manual'`. Defaults to `'follow'`.
   If `follow` or `error`, the response will not include status codes that are considered redirects (300, 301, 302, 303,
   307, and 308).

```ts
import { HttpSchema } from '@zimic/http';
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

//  highlight-start
const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});
//  highlight-end

console.log(response); // FetchResponse<Schema, 'GET', '/users'>
```

**Related**:

- [`Response` - MDN reference](https://developer.mozilla.org/docs/Web/API/Response)

## `response.request`

The [request](/docs/zimic-fetch/api/3-fetch-request.md) that originated the response.

**Type**: `FetchRequest<Schema, Method, Path>`

```ts
const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

console.log(response.request); // FetchRequest<Schema, 'POST', '/users'>
```

## `response.error`

An [error](/docs/zimic-fetch/api/5-fetch-response-error.md) associated with the response, if you need to throw it to be
handled elsewhere. `response.error` is always available, even if the response was successful, since some APIs may return
failure responses with status codes other than `4XX` or `5XX`, or may have different meanings for certain status codes.

**Type**: `FetchResponseError<Schema, Method, Path>`

```ts
const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

if (response.status === 404) {
  console.error(response.error); // FetchResponseError<Schema, 'POST', '/users'>
}
```

**Related**:

- [Guides - Handling errors](/docs/zimic-fetch/guides/6-errors.md)
