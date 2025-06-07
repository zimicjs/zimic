---
title: Using local interceptors | @zimic/interceptor
sidebar_label: Using local interceptors
slug: /interceptor/guides/http/local-interceptors
---

# Using local interceptors

HTTP interceptors allow you to handle requests and return custom responses. Their primary use is to mock HTTP requests
in development or testing environments, especially when the backend is unavailable or when you want to have more control
over the responses.

In `@zimic/interceptor`, HTTP interceptors are available in two types: `local` (default) and `remote`. When an
interceptor is `local`, Zimic uses [MSW](https://github.com/mswjs/msw) to intercept requests _in the same process_ as
your application. This is the simplest way to start mocking requests and does not require any server setup.

## When to use local HTTP interceptors

- **Development**

  Local interceptors are useful if you want to quickly mock requests for a single application in development, especially
  when the backend is not yet ready or when you want to test different scenarios without relying on a real server. In
  this case, interceptors allow you to set up mock responses and test your client-side code without depending on a
  backend service.

- **Testing**

  If you run your application in the same process as your tests, local interceptors are a great way to mock requests and
  verify how you application handles success and error responses. This is common when using unit and integration test
  runners such as [Jest](https://jestjs.io) and [Vitest](https://vitest.dev). Often, interceptors simplify the
  configuration of your test suites, because they allow you to easily simulate specific scenarios without needing to
  first set up a separate server, manage authentication, apply seed data, or handle other complexities o a real service.

## Creating a local HTTP interceptor

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
[`createHttpInterceptor`](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx). It takes the schema as a type
parameter and returns an interceptor instance. The `baseURL` option represents the scope of the interceptor and points
to the URL that your application will use to make requests.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  // highlight-next-line
  type: 'local', // optional
  baseURL: 'http://localhost:3000',
});
```

You can also set other options, such as the interceptor type and how unhandled requests should be treated. Refer to the
[`createHttpInterceptor` API reference](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx) for more details.

## HTTP interceptor lifecycle

### Starting an interceptor

To intercept requests, an interceptor must be started with
[`interceptor.start()`](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorstart). This is usually done in a
`beforeAll` hook in your test suite.

```ts
beforeAll(async () => {
  // highlight-next-line
  await interceptor.start();
});
```

:::info INFO: <span>Local interceptors in browsers</span>

If you are using a [local interceptor](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md) in a
**browser** environment, you must first
[initialize a mock service worker](/docs/zimic-interceptor/cli/2-browser.md#zimic-interceptor-browser-init) in your
public directory before starting the interceptor.

:::

### Clearing an interceptor

When using an interceptor in tests, it's important to clear it between tests to avoid that one test affects another.
This is done with [`interceptor.clear()`](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorclear), which
resets the interceptor and handlers to their initial states.

```ts
beforeEach(() => {
  //  highlight-next-line
  interceptor.clear();
});
```

### Checking expectations

After each test, you can check if your application has made all of the expected requests with
[`interceptor.checkTimes()`](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorchecktimes). Learn more about
how interceptors support [declarative assertions](/docs/zimic-interceptor/guides/http/7-declarative-assertions.mdx) to
keep your tests clean and readable.

```ts
afterEach(() => {
  //  highlight-next-line
  interceptor.checkTimes();
});
```

### Stopping an interceptor

After the interceptor is no longer needed, such as at the end of your test suite, you can stop it with
[`interceptor.stop()`](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorstop).

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
  interceptor
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

:::info INFO: <span>Local interceptors are synchronous</span>

Many operations in local interceptors are **synchronous** because they do not involve communication with an external
server. This is different from [remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md),
which communicate with an [interceptor server](/docs/zimic-interceptor/cli/1-server.md) to handle requests and return
responses.

:::

If you need to access the requests processed by the interceptor, use
[`handler.requests`](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerrequests).

```ts
// highlight-next-line
const handler = interceptor
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
