---
title: Handling errors | @zimic/fetch
sidebar_label: Handling errors
slug: /fetch/guides/errors
---

# Handling errors

`@zimic/fetch` fully types the requests and responses based on your [schema](/docs/zimic-http/guides/1-schemas.md). If a
response fails with a status code in the `4XX` or `5XX` ranges, the
[`response.ok`](https://developer.mozilla.org/docs/Web/API/Response/ok) property will be `false`. In this case,
`response.error` will contain a `FetchResponseError` representing the failure.

## Handling response errors

To handle errors, check the `response.status` or the `response.ok` properties to determine if the request was successful
or not. Alternatively, you can throw the `response.error` to handle it upper in the call stack.

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

Checking the `response.ok` and `response.status` properties is a good practice handle errors. A common strategy is to
first check status codes that require specific logic, depending on your application, and throwing other errors a global
error handler.

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

[`fetchResponseError.toObject()`](/docs/zimic-fetch/api/5-fetch-response-error.md#errortoobject) is useful get a plain
object representation of the error. This makes the error easier to log and inspect.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  // highlight-next-line
  const plainError = error.toObject();
  console.error(plainError);
}
```

You can also use
[`JSON.stringify()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) or a
logging library such as [`pino`](https://www.npmjs.com/package/pino) to serialize the error.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  const plainError = error.toObject();
  // highlight-next-line
  console.error(JSON.stringify(plainError));
}
```

Request and response bodies are not included by default in the result of `toObject`. If you want to see them, use
`includeRequestBody` and `includeResponseBody`. Note that the result will be a `Promise` that needs to be awaited.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  // highlight-start
  const plainError = await error.toObject({
    includeRequestBody: true,
    includeResponseBody: true,
  });
  // highlight-end
  console.error(JSON.stringify(plainError));
}
```

If you are working with form data or blob bodies, such as file uploads or downloads, logging the body may not be useful
as binary data won't be human-readable and may be too large. In that case, you can check the request and response and
include the bodies conditionally.

```ts
import { FetchResponseError } from '@zimic/fetch';

if (error instanceof FetchResponseError) {
  const requestContentType = error.request.headers.get('content-type');
  const responseContentType = error.response.headers.get('content-type');

  const plainError = await error.toObject({
    // Include the body only if the content type is JSON
    // highlight-start
    includeRequestBody: requestContentType === 'application/json',
    includeResponseBody: responseContentType === 'application/json',
    // highlight-end
  });
  console.error(JSON.stringify(plainError));
}
```
