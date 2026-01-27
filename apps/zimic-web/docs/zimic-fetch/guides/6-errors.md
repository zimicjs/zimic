---
title: Handling errors | @zimic/fetch
sidebar_label: Handling errors
slug: /fetch/guides/errors
---

# Handling errors

`@zimic/fetch` fully types the requests and responses based on your [schema](/docs/zimic-http/guides/1-schemas.md). If a
response fails with a status code in the `4XX` or `5XX` ranges, the
[`response.ok`](https://developer.mozilla.org/docs/Web/API/Response/ok) property will be `false`.

## Handling response errors

To handle response errors, check the `response.status` or the `response.ok` properties to determine if the request was
successful or not. In case you need to handle a response as an error upper in the call stack, you can throw the
[`response.error`](/docs/zimic-fetch/api/4-fetch-response.md#responseerror) property. `response.error` is always
available, even if the response has a `2XX` or `3XX` status code. Some noncompliant APIs may return failure responses
with status codes other than `4XX` or `5XX`, or may have different meanings for certain status codes, so your
application can handle those cases as response errors as needed.

:::important IMPORTANT: <span>Handling network errors</span>

Some network errors, such as DNS resolution failures, CORS errors, or request timeouts, may not return a valid HTTP
response. In these cases, `@zimic/fetch` will throw a native
[`TypeError`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypeError) instead of resolving
with a response, which is the default behavior of the [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API).
Make sure to handle these errors as necessary in your application.

:::

The [`onResponse`](/docs/zimic-fetch/api/2-fetch.md#fetchonresponse) listener can be a good strategy if you want to
handle errors transparently. The listener can automatically retry the request without bubbling the error up to the
caller. This is useful for recoverable errors, such as
[expired tokens](/docs/zimic-fetch/guides/5-authentication.md#handling-errors), network errors, or temporarily
unavailable services. You can also use it to [log errors](#logging-response-errors).

As an example, consider the following schema:

```ts
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      request: {
        headers?: { authorization?: string };
      };
      response: {
        // highlight-start
        200: { body: User };
        401: { body: { code: 'UNAUTHORIZED'; message: string } };
        403: { body: { code: 'FORBIDDEN'; message: string } };
        404: { body: { code: 'NOT_FOUND'; message: string } };
        500: { body: { code: 'INTERNAL_SERVER_ERROR'; message: string } };
        503: { body: { code: 'SERVICE_UNAVAILABLE'; message: string } };
        // highlight-end
      };
    };
  };
}>;
```

A GET request to `/users/:userId` may be successful with a `200` status code, or it may fail with a `401`, `403`, `404`,
`500`, or `503`. After receiving the response, we can check the status code and handle errors accordingly.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

async function fetchUser(userId: string) {
  const response = await fetch(`/users/${userId}`, {
    method: 'GET',
  });

  // If the user was not found, return null
  // highlight-start
  if (response.status === 404) {
    return null;
  }
  // highlight-end

  // If the request failed with other errors, throw them
  // highlight-start
  if (!response.ok) {
    throw response.error;
  }
  // highlight-end

  // At this point, we know the request was successful
  // highlight-start
  const user = await response.json(); // User
  return user;
  // highlight-end
}
```

:::tip TIP: <span>Throwing unknown errors</span>

Depending on your application, checking the `response.ok` and `response.status` properties can be a good practice to
handle errors. A common strategy is to first check status codes that require specific logic, if any, and throwing
`response.error` for all other errors to be handled elsewhere.

```ts
if (response.status === 401) {
  redirectToLogin();
}

if (response.status === 404) {
  return null;
}

if (response.status === 500) {
  showMessage('An unexpected error occurred.');
}

if (response.status === 503) {
  showMessage('The service is temporarily unavailable.');
}

// Throw any other error
// highlight-start
if (!response.ok) {
  throw response.error;
}
// highlight-end
```

:::

## Logging response errors

[`response.error.toObject()`](/docs/zimic-fetch/api/5-fetch-response-error.md#errortoobject) returns a plain object
representation of the error, making it easier to log, inspect, and debug.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  // highlight-next-line
  console.error(error.toObject());
}
```

Request and response bodies are not included by default in the result of `toObject()`. If you want to see them, use
`includeRequestBody` and `includeResponseBody`. Note that the result will be a `Promise` that needs to be awaited.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  // highlight-start
  const errorObject = await error.toObject({
    includeRequestBody: true,
    includeResponseBody: true,
  });
  // highlight-end
  console.error(JSON.stringify(errorObject));
}
```

#### Logging response errors with `pino`

If you are using [`pino`](https://www.npmjs.com/package/pino), a custom serializer may be useful to automatically call
[`response.error.toObject()`](/docs/zimic-fetch/api/5-fetch-response-error.md#errortoobject).

In the following example, we create a `logger.errorAsync` method to include the request and response bodies, if
available, which are serialized to a string using `util.inspect()` to improve readability. The default `logger.error`
method can still be used to log errors without the bodies.

```ts title='logger.ts'
import { FetchResponseError } from '@zimic/fetch';
import pino, { Logger, LoggerOptions } from 'pino';
import util from 'util';

function serializeBody(body: unknown) {
  return util.inspect(body, {
    colors: false,
    compact: true,
    depth: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    breakLength: Infinity,
    sorted: true,
  });
}

const syncSerializers = {
  err(error: unknown): unknown {
    // highlight-start
    if (error instanceof FetchResponseError) {
      // Log response error without bodies
      const errorObject = error.toObject({
        includeRequestBody: false,
        includeResponseBody: false,
      });

      return pino.stdSerializers.err(errorObject);
    }
    // highlight-end

    if (error instanceof Error) {
      return pino.stdSerializers.err(error);
    }

    return error;
  },
} satisfies LoggerOptions['serializers'];

const asyncSerializers = {
  async err(error: unknown): Promise<unknown> {
    // highlight-start
    if (error instanceof FetchResponseError) {
      // Log response error with bodies, if available
      const errorObject = await error.toObject({
        includeRequestBody: !error.request.bodyUsed,
        includeResponseBody: !error.response.bodyUsed,
      });

      // Serialize bodies to a string for better readability in the logs
      for (const resource of [errorObject.request, errorObject.response]) {
        if (resource.body !== undefined && resource.body !== null) {
          resource.body = serializeBody(resource.body);
        }
      }

      return pino.stdSerializers.err(errorObject);
    }
    // highlight-end

    return syncSerializers.err(error);
  },
} satisfies LoggerOptions['serializers'];

interface AsyncLogger extends Logger {
  // highlight-next-line
  errorAsync: (this: AsyncLogger, error: unknown, message?: string) => Promise<void>;
}

// Create logger
const logger = pino({
  messageKey: 'message',
  errorKey: 'error',
  nestedKey: 'data',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: syncSerializers,
}) satisfies Logger as AsyncLogger;

// Declare logger.errorAsync method
// highlight-start
logger.errorAsync = async function (this: AsyncLogger, error: unknown, message?: string) {
  const serializedError = await asyncSerializers.err(error);
  this.error(serializedError, message);
};
// highlight-end
```

Using the logger:

```ts
import { createFetch } from '@zimic/fetch';
import { logger } from './logger';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${userId}`, {
  method: 'GET',
});

if (response.ok) {
  logger.info('User fetched successfully.');
} else {
  // Synchronous, without bodies
  // highlight-next-line
  logger.error(response.error, `Could not fetch user ${userId}.`);

  // Asynchronous, with bodies if available
  // highlight-next-line
  await logger.errorAsync(response.error, `Could not fetch user ${userId}.`);
}
```
