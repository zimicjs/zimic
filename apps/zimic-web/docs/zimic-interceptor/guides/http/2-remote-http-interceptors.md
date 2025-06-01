---
title: Using remote interceptors | @zimic/interceptor
sidebar_label: Using remote interceptors
slug: /interceptor/guides/http/remote-interceptors
---

# Using remote interceptors

HTTP interceptors allow you to handle requests and return custom responses. Their primary use is to mock HTTP requests
in development or testing environments, especially when the backend is unavailable or when you want to have more control
over the responses.

In `@zimic/interceptor`, HTTP interceptors are available in two types: `local` (default) and `remote`. Interceptors with
type `remote` use a dedicated [interceptor server](/docs/zimic-interceptor/cli/1-server.md) to handle requests. This
opens up more possibilities for mocking than
[local interceptors](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md), such as handling requests from
multiple applications. It is also more robust because it uses a regular HTTP server and does not depend on local
interception algorithms.

## When to use remote HTTP interceptors

- **Development**

  Remote interceptors are useful if you want your mocked responses to be accessible by multiple applications (e.g.
  browser, other projects, `curl`). This is not possible with local interceptors, which only work in the application
  where they are defined. Remote interceptors allow you to set up a
  [mock server](/docs/zimic-interceptor/cli/1-server.md), which is fully configurable and can be used to mock requests
  in your local development or testing environment.

- **Testing**

  If you do not run your application in the same process as your tests, remote interceptors are the way to go to mock
  requests and verify how you application handles success and error responses. When using
  [Cypress](https://www.cypress.io), [Playwright](https://playwright.dev), or other end-to-end testing tools, this is
  generally the case because the test runner and the application run separately. Complex unit and integration test
  setups might also benefic from remote interceptors, such as testing a server that is running in another terminal.
  Because remote interceptors do not rely on local interception, they are generally more robust and simulate real server
  behavior more closely.

## Creating a remote HTTP interceptor

To start using an HTTP interceptor, declare an HTTP schema using [`@zimic/http`](/docs/zimic-http/guides/1-schemas.md).
The schema represents the structure of your API, including the paths, methods, request and response types.

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
        searchParams: { query?: string; limit?: number };
      };
      response: {
        200: { body: User[] };
        400: { body: { message?: string } };
        401: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };
}>;
```

With the schema defined, you can now create your interceptor with
[`createHttpInterceptor`](/docs/zimic-interceptor/api/1-create-http-interceptor.md). It takes the schema as a type
parameter and returns an interceptor instance. The `baseURL` option represents the scope of the interceptor and points
to the URL that your application will use to make requests.

In the case of a remote interceptor, the `baseURL` should point to an
[interceptor server](/docs/zimic-interceptor/cli/1-server.md), which is configured by the interceptor to handle
requests.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  // highlight-next-line
  type: 'remote',
  baseURL: 'http://localhost:3000',
});
```

You can also set other options, such as the interceptor type and how unhandled requests should be treated. Refer to the
[`createHttpInterceptor` API reference](/docs/zimic-interceptor/api/1-create-http-interceptor.md) for more details.

### Path discriminators

When using multiple remote interceptors connected to the same interceptor server, it is important to differentiate them
by using path discriminators. This is done by appending a suffix to the `baseURL` of each interceptor and makes sure
that no interceptor interferes with another's requests.

This is especially useful if you have multiple interceptors mocking different services or APIs, or if you are running
tests in parallel, each with its own interceptors.

Consider the following example:

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const authInterceptor = createHttpInterceptor<AuthSchema>({
  type: 'remote',
  // highlight-next-line
  baseURL: `http://localhost:3000/auth/${crypto.randomUUID()}`,
});

const notificationInterceptor = createHttpInterceptor<NotificationSchema>({
  type: 'remote',
  // highlight-next-line
  baseURL: `http://localhost:3000/notification/${crypto.randomUUID()}`,
});
```

Here, two remote interceptors are created, one for a fictional authentication service and another for a notification
service. Both interceptors use the same interceptor server, but they are differentiated by service with the paths
`/auth` and `/notification`. Moreover,
[`crypto.randomUUID()`](https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID) is used to generate a unique
identifier for each interceptor, which makes sure that they don't interfere with each other if multiple instances are
running at the same time.

If you are using a setup like this, note that your application should use the same base URL as the interceptor when
making requests, otherwise they may not be handled. A common strategy is to change an environment variable or similar to
point to the base URL of the interceptor.

```ts
process.env.AUTH_SERVICE_URL = authInterceptor.baseURL;
process.env.NOTIFICATION_SERVICE_URL = notificationInterceptor.baseURL;
```

## HTTP interceptor lifecycle

### Starting an interceptor

To intercept requests, start the interceptor server using the
[`zimic-interceptor server start`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-start) CLI. It can
run as a standalone server:

```bash
zimic-interceptor server start --port 3000
```

Or as a prefix of another command, such as a test runner or a script:

```bash
zimic-interceptor server start --port 3000 --ephemeral -- npm run test
```

The command after `--` will be executed when the server is ready. The flag `--ephemeral` indicates that the server
should automatically stop after the command `npm run test` finishes.

:::info IMPORTANT: <span>Interceptor server authentication</span>

If you are exposing the server publicly, consider [enabling authentication](#interceptor-server-authentication) in the
interceptor server.

:::

Once the server is running, you can start the interceptor
[`interceptor.start()`](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorstart). This is usually done in a
`beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

During the start up, the interceptor will connect to the server and get ready to handle requests.

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid that one test affects another.
This is performed with [`interceptor.clear()`](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorclear),
which resets the interceptor and handlers to their initial states.

```ts
beforeEach(async () => {
  //  highlight-next-line
  await interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has made all of the expected requests with
[`interceptor.checkTimes()`](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorchecktimes). Learn more about
how interceptors support [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx) to
keep your tests clean and readable.

```ts
afterEach(async () => {
  //  highlight-next-line
  await interceptor.checkTimes();
});
```

### Stopping an interceptor

After the interceptor is no longer needed, such as at the end of your test suite, you can stop it with
[`interceptor.stop()`](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorstop).

```ts
afterAll(async () => {
  //  highlight-next-line
  await interceptor.stop();
});
```

### Mocking requests

You can now use the interceptor to handle requests and return mock responses. All paths, methods, parameters, requests,
and responses are typed by default based on the schema.

```ts
test('example', async () => {
  const users: User[] = [{ username: 'me' }];

  //  highlight-start
  await interceptor
    .get('/users')
    .with({
      headers: { authorization: 'Bearer my-token' },
      searchParams: { query: 'u' },
    })
    .respond({
      status: 200,
      body: users,
    })
    .times(1);
  //  highlight-end

  // Run the application and make requests...
});
```

:::info INFO: <span>Remote interceptors are asynchronous</span>

Many operations in remote interceptors are **asynchronous** because they may involve communication with an interceptor
server. This is different from [local interceptors](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md),
which have mostly **synchronous** operations.

If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is
[`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks promises
appearing to be unhandled, which is helpful to indicate missing `await`'s in remote interceptor operations.

:::

If you need to access the requests processed by the interceptor, use
[`handler.requests`](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerrequests).

```ts
// highlight-next-line
const handler = await interceptor
  .get('/users')
  .with({
    headers: { authorization: 'Bearer my-token' },
    searchParams: { query: 'u' },
  })
  .respond({
    status: 200,
    body: users,
  })
  .times(1);

// Run the application and make requests...

console.log(handler.requests); // 1

console.log(handler.requests[0].headers.get('authorization')); // 'Bearer my-token'

console.log(handler.requests[0].searchParams.size); // 1
console.log(handler.requests[0].searchParams.get('username')); // 'my'

console.log(handler.requests[0].body); // null
```

### Interceptor server authentication

Interceptor servers can be configured to require interceptor authentication. This is **strongly recommended** if you are
exposing the server **publicly**. Without authentication, the server is unprotected and any interceptor can connect to
it and override the responses of any request.

To create an interceptor authentication token, use the
[`zimic-interceptor server token create`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-create)
CLI:

```bash
zimic-interceptor server token create \
  --name <token-name>
```

Then, start the server using the `--tokens-dir` option pointing to the directory where the tokens are saved. The server
will only accept remote interceptors bearing a valid token.

```bash
zimic-interceptor server start --port 3000 \
  --tokens-dir .zimic/interceptor/server/tokens
```

You can list the authorized tokens with
[`zimic-interceptor server token ls`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-ls).

:::important IMPORTANT: <span>Private tokens directory</span>

Make sure to keep the tokens directory private. Do not commit it to version control or expose it publicly. Even though
the tokens are hashed in the directory, exposing it can lead to security issues. If you are running the server inside a
container, make sure to persist the tokens directory, such as in a volume. Otherwise, the tokens will be lost when the
container is removed or recreated.

:::

Once the server is running, remote interceptors can use the `auth.token` option to provide a token.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  type: 'remote',
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  auth: { token: '<token>' },
});
```

Replace `<token>` with the token you created earlier. Interceptor tokens do not expire, so you can use the same token
for multiple interceptors. If you need to invalidate a token, use the
[`zimic-interceptor server token rm`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-token-rm) CLI.
