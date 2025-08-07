---
title: createFetch | @zimic/fetch
sidebar_label: createFetch
slug: /fetch/api/create-fetch
---

# `createFetch`

Creates a [`fetch`](/docs/zimic-fetch/api/2-fetch.md) instance typed with an HTTP schema, mostly compatible with the
native [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API). All requests and responses are typed by
default with a [schema](/docs/zimic-http/guides/1-schemas.md), including methods, paths, status codes, arguments, and
bodies.

```ts
createFetch<Schema>(options);
```

**Arguments**:

1. **options**: `FetchOptions`

   The options to create a [fetch instance](/docs/zimic-fetch/api/2-fetch.md) and use as defaults. They inherit from the
   native [`RequestInit`](https://developer.mozilla.org/docs/Web/API/RequestInit) interface, with the following
   additional properties:
   - **baseURL**: `string`

     The base URL for the fetch instance, which will be prepended to all request URLs.

   - **searchParams**: `HttpSearchParamsSchema.Loose | undefined`

     The default search parameters to be sent with each request.

   - **onRequest**: `((this: Fetch, request: FetchRequest.Loose) => Promise<Request> | Request) | undefined`

     A listener that is called before each request is sent. See [`onRequest`](#onrequest) for more details.

   - **onResponse**: `((this: Fetch, response: FetchResponse.Loose) => Promise<Response> | Response) | undefined`

     A listener that is called after each response is received. See [`onResponse`](#onresponse) for more details.

   - **duplex**: `'half' | undefined`

     The duplex mode for the fetch instance. If set to `'half'`, request bodies will be streamed. See
     [Request streaming](/docs/zimic-fetch/guides/4-bodies.md#request-streaming) for more details.

**Type arguments**:

1. **Schema**: `HttpSchema`

   The [HTTP schema](/docs/zimic-http/guides/1-schemas.md) to use for the fetch instance.

**Returns**: `Fetch`

A [fetch instance](/docs/zimic-fetch/api/2-fetch.md) typed with the provided schema.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

type Schema = HttpSchema<{
  // ...
}>;

// highlight-start
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});
// highlight-end
```

**Related**:

- [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API)

## `onRequest`

`createFetch` accepts an `onRequest` listener, which is a function that is called before sending each request.

```ts
onRequest(
  this: Fetch<Schema>,
  request: FetchRequest.Loose
): Promise<Request> | Request;
```

**Arguments**:

1. **request**: `FetchRequest.Loose`

   The [request](/docs/zimic-fetch/api/3-fetch-request.md) to send to the server.

**Returns**:

The request to use, either a modified version of the original request or a new one.

```ts
import { createFetch } from '@zimic/fetch';
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { page?: number; limit?: number };
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:80',

  // highlight-start
  onRequest(request) {
    if (this.isRequest(request, 'GET', '/users')) {
      const url = new URL(request.url);
      url.searchParams.append('limit', '10');

      const updatedRequest = new Request(url, request);
      return updatedRequest;
    }

    return request;
  },
  // highlight-end
});
```

**Related**:

- [`fetch.onRequest` API reference](/docs/zimic-fetch/api/2-fetch.md#fetchonrequest)

## `onResponse`

`createFetch` accepts an `onResponse` listener, which is a function that is called after receiving each response.

```ts
onResponse(
  this: Fetch<Schema>,
  response: FetchResponse.Loose
): Promise<Response> | Response;
```

**Arguments**:

1. **response**: `FetchResponse.Loose`

   The [response](/docs/zimic-fetch/api/4-fetch-response.md) received from the server.

**Returns**:

The response to use, either a modified version of the original response or a new one.

```ts
import { HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: {
        200: {
          headers: { 'content-encoding'?: string };
          body: User[];
        };
      };
    };
  };
}>;

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:80',

  // highlight-start
  onResponse(response) {
    if (this.isResponse(response, 'GET', '/users')) {
      console.log(response.headers.get('content-encoding'));
    }
    return response;
  },
  // highlight-end
});
```

**Related**:

- [`fetch.onResponse` API reference](/docs/zimic-fetch/api/2-fetch.md#fetchonresponse)
