---
title: Using headers | @zimic/fetch
sidebar_label: Using headers
slug: /fetch/guides/headers
---

# Using headers

[HTTP headers](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers) are key-value pairs that contain
additional information about a request or a response. They are commonly used to pass metadata, such as a content type,
[authentication tokens](/docs/zimic-fetch/guides/5-authentication.md), or caching directives.

## Using request headers

To send headers in your requests, declare their types in your [schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        // highlight-start
        headers: {
          authorization: string;
          'accept-language'?: string;
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

Then, set the headers in your fetch request using the [`headers`](/docs/zimic-fetch/api/1-create-fetch.md) option. They
are typed and validated according to your schema, providing type safety and autocompletion.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  // highlight-start
  headers: {
    authorization: `Bearer ${accessToken}`,
    'accept-language': 'en',
  },
  // highlight-end
});
```

### Using default request headers

A [fetch instance](/docs/zimic-fetch/api/2-fetch.md) can have [defaults](/docs/zimic-fetch/api/2-fetch.md#fetchdefaults)
that are applied to all requests. These include headers:

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  headers: { 'accept-language': 'en' },
});
```

You can also set headers after the fetch instance is created. This is useful for setting headers that are dynamic, such
as [authentication tokens](/docs/zimic-fetch/guides/5-authentication.md).

```ts
fetch.defaults.headers['accept-language'] = 'en';
fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
```

[`fetch.onRequest`](/docs/zimic-fetch/api/2-fetch.md#fetchonrequest) can also be used to set headers. Use this listener
if you need to apply logic to the headers, such as reading them from local storage or limiting them to specific
requests.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',

  // highlight-start
  onRequest(request) {
    if (this.isRequest(request, 'GET', '/users')) {
      request.headers.set('accept-language', 'en');
    }
    return request;
  },
  // highlight-end
});
```

## Using response headers

Similarly to requests, you can declare the types of response headers in your
[schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: {
        200: {
          // highlight-start
          headers: {
            'content-type': 'application/json';
            'content-encoding'?: string;
          };
          // highlight-end
          body: User[];
        };
      };
    };
  };
}>;
```

When a response is received, the headers are available at
[`response.headers`](/docs/zimic-fetch/api/4-fetch-response.md).

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
});

// highlight-start
console.log(response.headers.get('content-type')); // application/json
console.log(response.headers.get('content-encoding')); // string | null
// highlight-end
```

## Using cookies

Cookies can store data on the client side and are often used for authentication, session management, and tracking user
preferences.

Since cookies are a type of header, you can use them in the same way as other headers, declaring them in your
[schema](/docs/zimic-http/guides/1-schemas.md) and accessing them in requests and responses.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        // highlight-next-line
        headers: { cookie?: string };
      };
      response: {
        200: {
          // highlight-next-line
          headers: { 'set-cookie'?: string };
          body: User[];
        };
      };
    };
  };
}>;
```

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  // highlight-next-line
  headers: { cookie: 'sessionId=1e9f65ab; theme=dark' },
});

// highlight-next-line
console.log(response.headers.get('set-cookie'));
```

:::info INFO: <span>Cookies in browsers</span>

Cookies are automatically sent by a browser, so you don't need to manually set them when making requests. For more
information about cookies, see the [MDN documentation](https://developer.mozilla.org/docs/Web/HTTP/Guides/Cookies).

:::

:::warning WARNING: `HttpOnly` cookies

Cookies marked with the
[`HttpOnly` flag](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly) are not accessible
via client-side JavaScript. Even though they may be in your schema and included in the requests, you won't be able to
access them in your browser code, only on the server.

:::
