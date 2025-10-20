---
title: FetchRequest | @zimic/fetch
sidebar_label: FetchRequest
slug: /fetch/api/fetch-request
---

# `FetchRequest`

A type representing a typed fetch request, which inherits from the native
[Request](https://developer.mozilla.org/docs/Web/API/Request).

On top of the properties available in native requests, `FetchRequest` instances have their URL automatically prefixed
with the base URL of their fetch instance. [Default options](/docs/zimic-fetch/api/2-fetch.md#fetch-defaults) are also
applied, if present in the fetch instance.

The path of the request is extracted from the URL, excluding the base URL, and is available in the `path` property.

```ts
type FetchRequest<Schema, Method, Path>;
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

console.log(request); // FetchRequest<Schema, 'POST', '/users'>
```

**Related**:

- [`fetch.Request`](/docs/zimic-fetch/api/2-fetch.md#fetchrequest)
- [`Request` - MDN reference](https://developer.mozilla.org/docs/Web/API/Request)

## `request.path`

The path of the request, excluding the base URL.

**Type**: `string`

```ts
const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// highlight-next-line
console.log(request.path); // '/users'
```

## `request.method`

The HTTP method of the request.

**Type**: `HttpMethod`

```ts
const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// highlight-next-line
console.log(request.method); // 'POST'
```
