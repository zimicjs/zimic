---
title: Using headers | @zimic/interceptor
sidebar_label: Using headers
slug: /interceptor/guides/headers
---

# Using headers

[HTTP headers](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers) are key-value pairs that contain
additional information about a request or a response. They are commonly used to pass metadata, such as a content type,
[authentication tokens](/docs/zimic-fetch/guides/5-authentication.md), or caching directives.

## Using request headers

To use headers in your intercepted requests, declare their types in your [schema](/docs/zimic-http/guides/1-schemas.md).

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

Then, the headers of intercepted requests will be available in the `headers` property, such as in
[`handler.with()`](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerwith),
[computed responses](/docs/zimic-interceptor/api/3-http-request-handler.md#computed-responses), and
[`handler.requests`](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerrequests). The headers are typed and
validated according to your schema, providing type safety and autocompletion.

```ts
const handler = interceptor
  .get('/users')
  .with({
    // highlight-start
    headers: {
      authorization: 'Bearer my-token',
    },
    // highlight-end
  })
  .respond((request) => {
    // highlight-next-line
    console.log(request.headers.get('authorization'));

    return {
      status: 200,
      body: users,
    };
  })
  .times(1);

// Run the application and make requests...

console.log(handler.requests); // 1
// highlight-next-line
console.log(handler.requests[0].headers.get('authorization'));
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
            'content-language'?: string;
          };
          // highlight-end
          body: User[];
        };
      };
    };
  };
}>;
```

When sending a response to an intercepted request, you can set the headers in the
[`handler.respond`](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerrespond) method with the `headers`
property.

```ts
interceptor
  .get('/users')
  .respond({
    status: 200,
    // highlight-start
    headers: {
      'content-language': 'en',
    },
    // highlight-end
    body: users,
  })
  .times(1);
```
