---
title: Using search params (query) | @zimic/fetch
sidebar_label: Using search params (query)
slug: /fetch/guides/search-params
---

# Using search params (query)

[URL search parameters](https://developer.mozilla.org/docs/Web/API/URLSearchParams), also known as query parameters, are
a way to provide additional information to a request. They are encoded in the query string of a URL in key-value pairs.
Search params are typically used in [GET requests](https://developer.mozilla.org/docs/Web/HTTP/Reference/Methods/GET) to
filter, sort, or paginate data.

## Using request search params

To send search params in your requests, declare their types in your [schema](/docs/zimic-http/guides/1-http-schemas.md).

```ts title='schema.ts'
import { type HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        // highlight-start
        searchParams: {
          q?: string;
          page?: number;
          size?: number;
          orderBy?: 'createdAt:asc' | 'createdAt:desc';
        };
        // highlight-end
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;
```

Then, set the search params in your fetch request using the
[`searchParams`](/docs/zimic-fetch/api/2-fetch.md#searchparams) option. The search params are automatically encoded in
the URL and sent with the request.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  // highlight-start
  searchParams: {
    q: 'search term',
    page: 1,
    size: 10,
    orderBy: 'createdAt:desc',
  },
  // highlight-end
});
```

:::info INFO: <span>Differences compared to the native Fetch API</span>

Search params in `@zimic/fetch` are set using the `searchParams` option. This differs from the native
[Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API), which defines the params directly in the URL.

The motivation behind this is to make declaring search params more intuitive and type-safe. `searchParams` accepts a
plain object or an [`HttpSearchParams`](/docs/zimic-http/api/3-http-search-params.md) instance, which are typed and
validated based on your schema. This allows readable and type-safe search params, including autocompletion in your IDE.

If written in the native Fetch API, the above example would look like this:

```ts
const url = new URL('http://localhost:3000/users');
url.searchParams.append('q', 'search term');
url.searchParams.append('page', '1');
url.searchParams.append('size', '10');
url.searchParams.append('orderBy', 'createdAt:desc');

const response = await fetch(url, { method: 'GET' });
```

:::

### Setting default request search params

A [fetch instance](/docs/zimic-fetch/api/2-fetch.md) can have
[defaults](/docs/zimic-fetch/api/1-create-fetch.md#defaults) that are applied to all requests. These include search
params:

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  searchParams: { size: 10, orderBy: 'createdAt:desc' },
});
```

You can also set search params after the fetch instance is created.

```ts
fetch.defaults.searchParams.orderBy = 'createdAt:desc';
```

[`fetch.onRequest`](/docs/zimic-fetch/api/2-fetch.md#onrequest) can also be used to set search params. Use this listener
if you need to apply logic to the search params, such as limiting them to certain requests or reading them from local
storage.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',

  // highlight-start
  onRequest(request) {
    if (this.isRequest(request, 'GET', '/users')) {
      const url = new URL(request.url);
      url.searchParams.append('size', '10');

      const updatedRequest = new Request(url, request);
      return updatedRequest;
    }

    return request;
  },
  // highlight-end
});
```

Note that we need to create a new `Request` object to change the search params. This is because the URL of a request is
immutable, including the search params.
