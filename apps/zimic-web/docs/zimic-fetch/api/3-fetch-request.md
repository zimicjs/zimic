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

## `request.toObject()`

Converts the request into a plain object. This method is useful for serialization, debugging, and logging purposes.

```ts
request.toObject();
request.toObject(options);
```

**Arguments**:

1. `options`: `FetchRequestObjectOptions | undefined`

   The options for converting the request. By default, the body of the request will not be included.
   - `includeBody`: `boolean | undefined` (default `false`)

     Whether to include the body of the request.

**Returns**: `FetchRequestObject`

A plain object representing this request. If `options.includeBody` is `true`, the body will be included and the return
is a `Promise`. Otherwise, the return is the plain object itself without the body.

```ts
const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// highlight-next-line
const requestObject = request.toObject();
console.log(requestObject);
// { url: '...', path: '/users', method: 'POST', ... }

// highlight-next-line
const requestObjectWithBody = await request.toObject({ includeBody: true });
console.log(requestObjectWithBody);
// { url: '...', path: '/users', method: 'POST', body: { username: 'me' }, ... }
```

If included, the body is parsed automatically based on the `content-type` header of the request.

| `content-type`                      | Parsed as                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| `application/json`                  | `JSON` (object)                                                    |
| `application/xml`                   | `string`                                                           |
| `application/x-www-form-urlencoded` | [`HttpSearchParams`](/docs/zimic-http/api/3-http-search-params.md) |
| `application/*` (others)            | `Blob`                                                             |
| `multipart/form-data`               | [`HttpFormData`](/docs/zimic-http/api/4-http-form-data.md)         |
| `multipart/*` (others)              | `Blob`                                                             |
| `text/*`                            | `string`                                                           |
| `image/*`                           | `Blob`                                                             |
| `audio/*`                           | `Blob`                                                             |
| `font/*`                            | `Blob`                                                             |
| `video/*`                           | `Blob`                                                             |
| `*/*` (others)                      | `JSON` (object) if possible, otherwise `Blob`                      |

:::tip NOTE: <span>Already used body</span>

If the body of the request has already been used (e.g., read with
[`request.json()`](https://developer.mozilla.org/docs/Web/API/Request/json)), it will not be included in the plain
object, even if `options.includeBody` is `true`. This will be flagged with a warning in the console.

If you access the body before calling `request.toObject()`, consider reading it from a cloned request with
[`request.clone()`](https://developer.mozilla.org/docs/Web/API/Request/clone).

```ts
const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// Reading the body from a cloned request:
// highlight-next-line
const requestBody = await request.clone().json();
console.log(requestBody);

const requestObject = await request.toObject({ includeBody: true });
console.log(requestObject);
```

Alternatively, you can disable the warning by including the body conditionally based on
[`request.bodyUsed`](https://developer.mozilla.org/docs/Web/API/Request/bodyUsed).

```ts
// Include the body only if available:
const requestObject = await request.toObject({
  // highlight-next-line
  includeBody: !request.bodyUsed,
});
```

:::
