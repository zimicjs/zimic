---
title: Authentication | @zimic/fetch
sidebar_label: Authentication
slug: /fetch/guides/authentication
---

# Authentication

[Authentication](https://developer.mozilla.org/docs/Web/HTTP/Guides/Authentication) is a process of verifying the
identity of a user or system. When using a web API, authentication is often required to ensure that only authorized
users can access certain resources or perform specific actions.

Servers may require authentication in different ways, such as using an API key, a token, a cookie, or username and
password.

## Authentication with headers

You can authenticate specific requests by adding the necessary headers.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'GET',
  // highlight-next-line
  headers: { authorization: `Bearer ${accessToken}` },
  searchParams: { query: 'u' },
});
```

Learn more about [using request headers](/docs/zimic-fetch/guides/1-headers.md#using-request-headers).

### Using defaults

A fetch instance can have [default options](/docs/zimic-fetch/api/2-fetch.md#defaults). These are useful for configuring
common headers and other options to authenticate all requests, without having to manually set them for each request.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

// highlight-next-line
fetch.defaults.headers.authorization = `Bearer ${accessToken}`;
```

Learn more about [using default request headers](/docs/zimic-fetch/guides/1-headers.md#using-default-request-headers).

### Using listeners

You can also use the [`onRequest`](/docs/zimic-fetch/api/2-fetch.md#onrequest) listener to set headers for specific
requests. The listener is called before every request is sent, so you can use it to include or modify authentication
options.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',

  onRequest(request) {
    // highlight-next-line
    request.headers.set('authorization', `Bearer ${accessToken}`);
    return request;
  },
});
```

### Handling errors

If a request fails due to authentication, you can handle the error in the
[`onResponse`](/docs/zimic-fetch/api/2-fetch.md#onresponse) listener. A common use case is to refresh the access token
and retry the request with the new credentials.

As an example, consider the following [schema](/docs/zimic-http/guides/1-schemas.md):

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/auth/login': {
    POST: {
      request: {
        // highlight-next-line
        body: { username: string; password: string };
      };
      response: {
        // highlight-next-line
        201: { body: { accessToken: string } };
      };
    };
  };

  '/auth/refresh': {
    POST: {
      response: {
        // highlight-next-line
        201: { body: { accessToken: string } };
      };
    };
  };

  '/users': {
    GET: {
      request: {
        // highlight-next-line
        headers?: { authorization?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { code: string; message: string } };
        403: { body: { code: string; message: string } };
      };
    };
  };
}>;
```

We can declare a fetch instance with an `onResponse` listener that handles authentication errors. If the request fails
with an access token expired error, the instance will try to refresh the token and retry the request.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',

  async onResponse(response) {
    if (response.status === 401) {
      const body = await response.clone().json();

      // Check the response body from the server
      if (body.code === 'ERR_ACCESS_TOKEN_EXPIRED') {
        // The access token is expired, so we need to refresh it
        const refreshResponse = await this('/auth/refresh', {
          method: 'POST',
        });
        const { accessToken } = await refreshResponse.json();

        // Set the new access token in the default headers
        const newAuthorization = `Bearer ${accessToken}`;
        // highlight-next-line
        fetch.defaults.headers.authorization = newAuthorization;

        // Clone the original request and update its headers
        const updatedRequest = response.request.clone();
        // highlight-next-line
        updatedRequest.headers.set('authorization', newAuthorization);

        // Retry the original request with the updated headers
        // highlight-next-line
        return this.loose(updatedRequest);
      }
    }

    return response;
  },
});
```

[`fetch.loose`](/docs/zimic-fetch/api/2-fetch.md#loose) is useful here because it is a less strict version of
[`fetch`](/docs/zimic-fetch/api/2-fetch.md). It allows us to retry the failed request without knowing which specific
endpoint and method it was made with.

With this setup, we can make authenticated requests to the API and access tokens will be automatically refreshed when
they expire.

```ts
// Authenticate
const loginRequest = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me', password: 'password' }),
});
const { accessToken } = await loginRequest.json();

// Set the authorization header for all requests
fetch.defaults.headers.authorization = `Bearer ${accessToken}`;

// Make requests authenticated by default
const request = await fetch('/users', {
  method: 'GET',
  searchParams: { query: 'u' },
});

const users = await request.json(); // User[]
```

:::note

The example in this section is a simplified implementation. In a real-world application, you should tailor your code to
the behavior of your API, such as error cods, response formats, and authentication methods.

:::
