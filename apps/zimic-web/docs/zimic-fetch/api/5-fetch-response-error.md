---
title: FetchResponseError | @zimic/fetch
sidebar_label: FetchResponseError
slug: /fetch/api/fetch-response-error
---

# `FetchResponseError`

An error representing a response with a failure status code (4XX or 5XX).

## `constructor()`

Creates a new `FetchResponseError` instance.

```ts
new FetchResponseError<Schema, Method, Path>(request, response);
```

**Arguments**:

1. **request**: `FetchRequest`

   The [fetch request](/docs/zimic-fetch/api/3-fetch-request.md) that caused the error.

2. **response**: `FetchResponse`

   The [fetch response](/docs/zimic-fetch/api/4-fetch-response.md) that caused the error.

**Type arguments**:

1. **Schema**: `HttpSchema`

   The [HTTP schema](/docs/zimic-http/guides/1-schemas.md) used for the fetch instance.

2. **Method**: `string`

   The HTTP method of the request that caused the error. Must be one of the methods of the path defined in the schema.

3. **Path**: `string`

   The path of the request that caused the error. Must be one of the paths defined in the schema.

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

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (!response.ok) {
  // highlight-next-line
  console.log(response.error); // FetchResponseError<Schema, 'GET', '/users'>
}
```

## `error.toObject()`

Converts the error into a plain object. This method is useful for serialization, debugging, and logging purposes.

```ts
error.toObject();
error.toObject(options);
```

**Arguments**:

1. `options`: `FetchResponseErrorObjectOptions`

   The options for converting the error. By default, the body of the request and response will not be included.
   - `includeRequestBody`: `boolean | undefined` (default `false`)

     Whether to include the body of the request in the plain object.

   - `includeResponseBody`: `boolean | undefined` (default `false`)

     Whether to include the body of the response in the plain object.

**Returns**: `FetchResponseErrorObject`

A plain object representing this error. If `options.includeRequestBody` or `options.includeResponseBody` is `true`, the
body of the request and response will be included, respectively, and the return is a `Promise`. Otherwise, the return is
the plain object itself without the bodies.

```ts
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (!response.ok) {
  // highlight-next-line
  const errorObject = response.error.toObject();
  console.log(errorObject);
  // { name: 'FetchResponseError', message: '...', request: { ... }, response:{ ... } }

  // highlight-next-line
  const errorObjectWithBodies = await response.error.toObject({
    includeRequestBody: true,
    includeResponseBody: true,
  });
  console.log(errorObjectWithBodies);
  // { name: 'FetchResponseError', message: '...', request: { ... }, response:{ ... } }
}
```

:::tip NOTE: <span>Already used bodies</span>

If the body of the request or response has already been used (e.g., read with
[`response.json()`](https://developer.mozilla.org/docs/Web/API/Response/json)), it will not be included in the plain
object, even if `options.includeRequestBody` or `options.includeResponseBody` is `true`. This will be flagged with a
warning in the console.

If you access a body before calling `error.toObject()`, consider reading it from a cloned request or response with
[`request.clone()`](https://developer.mozilla.org/docs/Web/API/Request/clone) or
[`response.clone()`](https://developer.mozilla.org/docs/Web/API/Response/clone), respectively.

```ts
const request = new fetch.Request(`/users/${userId}`, {
  method: 'POST',
  body: JSON.stringify({ ... }),
});

// Reading the body from a cloned request:
// highlight-next-line
const requestBody = await request.clone().json();
console.log(requestBody);

const response = await fetch(request);

// Reading the body from a cloned response:
// highlight-next-line
const responseBody = await response.clone().json();
console.log(responseBody);

if (!response.ok) {
  const errorObject = await response.error.toObject({
    includeRequestBody: true,
    includeResponseBody: true,
  });
  console.log(errorObject);
}
```

Alternatively, you can disable the warning by including each body conditionally based on
[`request.bodyUsed`](https://developer.mozilla.org/docs/Web/API/Request/bodyUsed) and
[`response.bodyUsed`](https://developer.mozilla.org/docs/Web/API/Response/bodyUsed).

```ts
// Include the bodies only if available:
const errorObject = await response.error.toObject({
  // highlight-start
  includeRequestBody: !response.error.request.bodyUsed,
  includeResponseBody: !response.error.response.bodyUsed,
  // highlight-end
});
```

:::
