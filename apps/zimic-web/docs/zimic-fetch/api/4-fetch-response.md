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

**Related**:

- [`fetch.Response`](/docs/zimic-fetch/api/2-fetch.md#fetchresponse)
- [`Response` - MDN reference](https://developer.mozilla.org/docs/Web/API/Response)
