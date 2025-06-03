---
title: FetchRequest | @zimic/fetch
sidebar_label: FetchRequest
slug: /fetch/api/fetch-request
---

# `FetchRequest`

A type representing a typed fetch request, which inherits from the native
[Request](https://developer.mozilla.org/docs/Web/API/Request).

On top of the properties available in native requests, `FetchRequest` instances have their URL automatically prefixed
with the base URL of their fetch instance. [Default options](/docs/zimic-fetch/api/2-fetch.md#fetchdefaults) are also
applied, if present in the fetch instance.

The path of the request is extracted from the URL, excluding the base URL, and is available in the `path` property.

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

const request = new fetch.Request('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
});

console.log(request); // FetchRequest<Schema, 'POST', '/users'>
console.log(request.path); // '/users'
```

**Related**:

- [`fetch.Request`](/docs/zimic-fetch/api/2-fetch.md#fetchrequest)
- [`Request` - MDN reference](https://developer.mozilla.org/docs/Web/API/Request)
