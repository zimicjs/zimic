---
title: FetchResponse | @zimic/fetch
sidebar_label: FetchResponse
slug: /fetch/api/fetch-response
---

# `FetchResponse`

A class representing a typed fetch response, which inherits from the native
[Response](https://developer.mozilla.org/docs/Web/API/Response).

On top of the properties available in native responses, `FetchResponse` instances have a reference to the originating
request, accessible via the `request` property. If the response has a failure status code (4XX or 5XX), an error is
available in the `error` property.

## `constructor()`

Creates a new `FetchResponse` instance.

```ts
new FetchResponse<Schema, Method, Path, ErrorOnly, Redirect>(request, body);
new FetchResponse<Schema, Method, Path, ErrorOnly, Redirect>(request, body, init);
```

**Arguments**:

1. **request**: `FetchRequest`

The [fetch request](/docs/zimic-fetch/api/3-fetch-request.md) that originated this response.

2. **response**: `Response`

A native `Response` instance to wrap as a typed fetch response.

3. **body**: `FetchResponseBodySchema | undefined`

The response body to create a response from when not providing `response`.

4. **init**: `FetchResponseInit | undefined`

Optional response initialization options (for example `status` and `headers`) used with `body`.

**Type arguments**:

1. **Schema**: `HttpSchema`

   The [HTTP schema](/docs/zimic-http/guides/1-schemas.md) used for the fetch instance.

2. **Method**: `string`

   The HTTP method of the request that caused the response. Must be one of the methods of the path defined in the
   schema.

3. **Path**: `string`

   The path of the request that caused the response. Must be one of the paths defined in the schema.

4. **ErrorOnly**: `boolean`

   If `true`, the response will only include the status codes that are considered errors (4XX or 5XX). This type
   argument is deprecated and will be removed in @zimic/fetch@2.

5. **Redirect**: `RequestRedirect`

   The redirect mode for the request, which can be one of `'follow'`, `'error'`, or `'manual'`. Defaults to `'follow'`.
   If `follow` or `error`, the response will not include status codes that are considered redirects (300, 301, 302, 303,
   307, and 308).

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch, FetchResponse } from '@zimic/fetch';

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

const request = new fetch.Request(`/users/${userId}`, {
  method: 'GET',
});

//  highlight-start
const response = new FetchResponse(
  request,
  JSON.stringify({
    id: crypto.randomUUID(),
    username: 'me',
  }),
  {
    status: 200,
    headers: { 'content-type': 'application/json' },
  },
);
//  highlight-end

console.log(response); // FetchResponse<Schema, 'GET', '/users/:userId', false, 'follow'>
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
handled elsewhere. `response.error` is always available, even if the response has a `2XX` or `3XX` status code. Some
noncompliant APIs may return failure responses with status codes other than `4XX` or `5XX`, or may have different
meanings for certain status codes, so your application can handle those cases as response errors as needed.

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

## `response.toObject()`

Converts the response into a plain object. This method is useful for serialization, debugging, and logging purposes.

```ts
response.toObject();
response.toObject(options);
```

**Arguments**:

1. `options`: `FetchResponseObjectOptions | undefined`

   The options for converting the response. By default, the body of the response will not be included.
   - `includeBody`: `boolean | undefined` (default `false`)

     Whether to include the body of the response.

**Returns**: `FetchResponseObject`

A plain object representing this response. If `options.includeBody` is `true`, the body will be included and the return
is a `Promise`. Otherwise, the return is the plain object itself without the body.

```ts
const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// highlight-next-line
const responseObject = response.toObject();
console.log(responseObject);
// { url: '...', status: 201, ok: true, ... }

// highlight-next-line
const responseObjectWithBody = await response.toObject({ includeBody: true });
console.log(responseObjectWithBody);
// { url: '...', status: 201, ok: true, body: { ... }, ... }
```

If included, the body is parsed automatically based on the `content-type` header of the response.

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

If the body of the response has already been used (e.g., read with
[`response.json()`](https://developer.mozilla.org/docs/Web/API/Response/json)), it will not be included in the plain
object, even if `options.includeBody` is `true`. This will be flagged with a warning in the console.

If you access the body before calling `response.toObject()`, consider reading it from a cloned response with
[`response.clone()`](https://developer.mozilla.org/docs/Web/API/Response/clone).

```ts
const response = await fetch('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

// Reading the body from a cloned response:
// highlight-next-line
const responseBody = await response.clone().json();
console.log(responseBody);

const responseObject = await response.toObject({ includeBody: true });
console.log(responseObject);
```

Alternatively, you can disable the warning by including the body conditionally based on
[`response.bodyUsed`](https://developer.mozilla.org/docs/Web/API/Response/bodyUsed).

```ts
// Include the body only if available:
const responseObject = await response.toObject({
  // highlight-next-line
  includeBody: !response.bodyUsed,
});
```

:::

**Related**:

- [Guides - Handling errors](/docs/zimic-fetch/guides/6-errors.md)
