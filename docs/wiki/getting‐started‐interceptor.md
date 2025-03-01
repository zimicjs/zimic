# Getting started: `@zimic/interceptor` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [1. Requirements](#1-requirements)
  - [Supported environments](#supported-environments)
  - [Supported languages](#supported-languages)
- [2. Installation](#2-installation)
- [3. Post-install](#3-post-install)
  - [Client-side post-install](#client-side-post-install)
  - [Server-side post-install](#server-side-post-install)
- [4. Choose your method to intercept requests](#4-choose-your-method-to-intercept-requests)
  - [Local HTTP interceptors](#local-http-interceptors)
    - [When to use local HTTP interceptors](#when-to-use-local-http-interceptors)
  - [Remote HTTP interceptors](#remote-http-interceptors)
    - [When to use remote HTTP interceptors](#when-to-use-remote-http-interceptors)
- [5. Create your interceptor](#5-create-your-interceptor)
- [6. Next steps](#6-next-steps)

---

[`@zimic/interceptor`](../../packages/zimic-interceptor) provides a flexible and type-safe way to intercept and mock
HTTP requests.

## 1. Requirements

### Supported environments

- If you are on the **client side**:
  - Any relatively modern browser (we recommend a recent version of a Chromium browser, such as
    [Google Chrome](https://www.google.com/chrome) or [Microsoft Edge](https://www.microsoft.com/edge))
- If you are on the **server side**:
  - [Node](https://nodejs.org) >= 18.13.0

`@zimic/interceptor` is mainly a development and testing library. It should not be used in production environments.

### Supported languages

- [TypeScript](https://www.typescriptlang.org) >= 4.8
- [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript) >= ES6
  - `@zimic/interceptor` is fully functional on JavaScript, but consider using TypeScript for improved type safety and
    editor support.

If you are using TypeScript, we recommend enabling `strict` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## 2. Installation

`@zimic/interceptor` is available on [npm](https://www.npmjs.com/package/@zimic/interceptor).

| Manager | Command                                                 |
| :-----: | ------------------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/interceptor --save-dev` |
|  yarn   | `yarn add @zimic/http @zimic/interceptor --dev`         |
|  pnpm   | `pnpm add @zimic/http @zimic/interceptor --dev`         |

We also canary releases under the tag `canary`, containing the latest features and bug fixes:

| Manager | Command                                                               |
| :-----: | --------------------------------------------------------------------- |
|   npm   | `npm install @zimic/http@canary @zimic/interceptor@canary --save-dev` |
|  yarn   | `yarn add @zimic/http@canary @zimic/interceptor@canary --dev`         |
|  pnpm   | `pnpm add @zimic/http@canary @zimic/interceptor@canary --dev`         |

## 3. Post-install

### Client-side post-install

If you plan to use [local interceptors](#local-http-interceptors) and run Zimic in a browser, you must first
[initialize a mock service worker](cli‐zimic‐browser#zimic-interceptor-browser-init) in your public directory. After
that, you are ready to start mocking!

### Server-side post-install

No additional configuration is required for server-side applications!

## 4. Choose your method to intercept requests

Zimic interceptors support two types of execution: `local` and `remote`.

> [!TIP]
>
> Multiple interceptors with different types are perfectly possible in the same application. However, keep in mind that
> local interceptors have precedence over remote interceptors.

### Local HTTP interceptors

When an interceptor is `local`, Zimic uses [MSW](https://github.com/mswjs/msw) to intercept requests _in the same
process_ as your application. This is the simplest way to start mocking requests and does not require any server setup.

Our [Vitest](../../examples/README.md#vitest), [Jest](../../examples/README.md#jest), and
[Next.js Pages Router](../../examples/README.md#nextjs) examples use local interceptors.

#### When to use local HTTP interceptors

- **Testing**: If you run your application in the _same_ process as your tests. This is common when using unit and
  integration test runners such as [Jest](https://jestjs.io) and [Vitest](https://vitest.dev).
- **Development**: If you want to mock requests in your development environment without setting up a server. This is
  useful when you need a backend that is not ready or available.

> [!IMPORTANT]
>
> All mocking operations in local interceptor are **synchronous**. There's no need to `await` them before making
> requests.

### Remote HTTP interceptors

When an interceptor is `remote`, Zimic uses a dedicated local [interceptor server](cli‐zimic‐server) to handle requests.
This opens up more possibilities for mocking, such as handling requests from multiple applications. It is also more
robust because it uses a regular HTTP server and does not depend on local interception algorithms.

Our [Playwright](../../examples/README.md#playwright) and [Next.js App Router](../../examples/README.md#nextjs) examples
use remote interceptors.

#### When to use remote HTTP interceptors

- **Testing**: If you _do not_ run your application in the same process as your tests. When using Cypress, Playwright,
  or other end-to-end testing tools, this is generally the case because the test runner and the application run in
  separate processes. This might also happen in more complex setups with unit and integration test runners, such as
  testing a server that is running in another process, terminal, or machine.
- **Development**: If you want your mocked responses to be accessible by other processes in your local network (e.g.
  browser, app, `curl`) . A common scenario is to create a mock server along with a script to apply the mocks. After
  started, the server can be accessed by other applications and return mock responses.

> [!IMPORTANT]
>
> All mocking operations in remote interceptors are **asynchronous**. Make sure to `await` them before making requests.
>
> Many code snippets in this wiki show examples with a local and a remote interceptor. Generally, the remote snippets
> differ only by adding `await` where necessary.
>
> If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is
> [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks
> promises appearing to be unhandled, which is helpful to indicate missing `await`'s in remote interceptor operations.

## 5. Create your interceptor

1.  Declare your HTTP schema using [`@zimic/http`](api‐zimic‐http):

    ```ts
    import { type HttpSchema } from '@zimic/http';

    interface User {
      username: string;
    }

    interface RequestError {
      code: string;
      message: string;
    }

    type Schema = HttpSchema<{
      '/users': {
        POST: {
          request: { body: User };
          response: {
            201: { body: User };
            400: { body: RequestError };
            409: { body: RequestError };
          };
        };

        GET: {
          request: {
            headers: { authorization: string };
            searchParams: { query?: string; limit?: `${number}` };
          };
          response: {
            200: { body: User[] };
            400: { body: RequestError };
            401: { body: RequestError };
          };
        };
      };

      '/users/:userId': {
        PATCH: {
          request: {
            headers: { authorization: string };
            body: Partial<User>;
          };
          response: {
            204: {};
            400: { body: RequestError };
          };
        };
      };
    }>;
    ```

    You can also use [`zimic-http typegen`](cli‐zimic‐typegen) to automatically generate types for your HTTP schema.

2.  Create your [interceptor](api‐zimic‐interceptor‐http#httpinterceptorcreateoptions):

    <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

    ```ts
    import { httpInterceptor } from '@zimic/interceptor/http';

    const interceptor = httpInterceptor.create<Schema>({
      type: 'local',
      baseURL: 'http://localhost:3000',
      saveRequests: true, // Allow access to `handler.requests()`
    });
    ```

    </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

    ```ts
    import { httpInterceptor } from '@zimic/interceptor/http';

    const interceptor = httpInterceptor.create<Schema>({
      type: 'remote',
      // The interceptor server is at http://localhost:4000
      baseURL: 'http://localhost:4000/my-service',
      saveRequests: true, // Allow access to `handler.requests()`
    });
    ```

    </details></td></tr></table>

    In this example, we're [creating an interceptor](api‐zimic‐interceptor‐http#httpinterceptorcreateoptions) for a
    service supporting `POST` and `GET` requests to `/users`. A successful response after creating a user is a `User`
    object, whereas listing users returns an array of `User` objects. Errors are represented by a `RequestError` object.

3.  Manage your [interceptor lifecycle](guides‐testing‐interceptor):

    4.1. [Start intercepting requests](api‐zimic‐interceptor‐http#http-interceptorstart):

    ```ts
    beforeAll(async () => {
      await interceptor.start();
    });
    ```

    If you are [creating a remote interceptor](api‐zimic‐interceptor‐http#creating-a-remote-http-interceptor), it's
    necessary to have a running [interceptor server](cli‐zimic‐server#zimic-interceptor-server-start) before starting
    it. The base URL of the remote interceptor should point to the server, optionally including a path to differentiate
    from other interceptors.

    4.2. [Clear your interceptors](api‐zimic‐interceptor‐http#http-interceptorclear) so that no tests affect each other:

    <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

    ```ts
    beforeEach(() => {
      interceptor.clear();
    });
    ```

    </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

    ```ts
    beforeEach(() => {
      await interceptor.clear();
    });
    ```

    </details></td></tr></table>

    4.3. [Check that all expected requests were made](api‐zimic‐interceptor‐http#http-interceptorchecktimes):

    <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

    ```ts
    afterEach(() => {
      interceptor.checkTimes();
    });
    ```

    </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

    ```ts
    afterEach(() => {
      await interceptor.checkTimes();
    });
    ```

    </details></td></tr></table>

    4.4. [Stop intercepting requests](api‐zimic‐interceptor‐http#http-interceptorstop):

    ```ts
    afterAll(async () => {
      await interceptor.stop();
    });
    ```

4.  Enjoy mocking!

    5.1. Mock a response:

    <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

    ```ts
    test('example', async () => {
      const users: User[] = [{ username: 'me' }];

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

      /// ...
    });
    ```

    </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

    ```ts
    test('example', async () => {
      const users: User[] = [{ username: 'me' }];

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

      /// ...
    });
    ```

    </details></td></tr></table>

    Learn more about [`with(restrictions)`](api‐zimic‐interceptor‐http#http-handlerwithrestriction),
    [`respond(declaration)`](api‐zimic‐interceptor‐http#http-handlerresponddeclaration), and
    [`times(times)`](api‐zimic‐interceptor‐http#http-handlertimes).

    5.2. After your application made requests, check if they are as you expect:

    <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

    ```ts
    // Your application makes requests...

    const requests = handler.requests();
    expect(requests).toHaveLength(1);

    expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

    expect(requests[0].searchParams.size).toBe(1);
    expect(requests[0].searchParams.get('username')).toBe('my');

    expect(requests[0].body).toBe(null);
    ```

    </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

    ```ts
    // Your application makes requests...

    const requests = await handler.requests();
    expect(requests).toHaveLength(1);

    expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

    expect(requests[0].searchParams.size).toBe(1);
    expect(requests[0].searchParams.get('username')).toBe('my');

    expect(requests[0].body).toBe(null);
    ```

    </details></td></tr></table>

    NOTE: The code above checks the requests manually. This is optional in this example because the
    [`with`](api‐zimic‐interceptor‐http#http-handlerwithrestriction) and
    [`times`](api‐zimic‐interceptor‐http#http-handlertimes) calls act as a declarative validation, meaning that exactly
    one request is expected with specific data. If fewer or more requests are received, the test will fail when
    `interceptor.checkTimes()` is called in the `afterEach` hook.

## 6. Next steps

- Take a look at our [examples](../../examples/README.md) and [testing guide](guides‐testing‐interceptor).

- Check out the API reference:

  - [`HttpInterceptor`](api‐zimic‐interceptor‐http#httpinterceptor)
    - [Creating a local HTTP interceptor](api‐zimic‐interceptor‐http#creating-a-local-http-interceptor)
    - [Creating a remote HTTP interceptor](api‐zimic‐interceptor‐http#creating-a-remote-http-interceptor)
    - [Managing unhandled requests](api‐zimic‐interceptor‐http#unhandled-requests)
    - [Saving intercepted requests](api‐zimic‐interceptor‐http#saving-requests)
    - [`HttpInterceptor` utility types](api‐zimic‐interceptor‐http#httpinterceptor-utility-types)
  - [`HttpRequestHandler`](api‐zimic‐interceptor‐http#httprequesthandler)
    - [Declaring restrictions](api‐zimic‐interceptor‐http#http-handlerwithrestriction)
      - [Static restrictions](api‐zimic‐interceptor‐http#static-restrictions)
      - [Computed restrictions](api‐zimic‐interceptor‐http#computed-restrictions)
    - [Declaring responses](api‐zimic‐interceptor‐http#http-handlerresponddeclaration)
      - [Static responses](api‐zimic‐interceptor‐http#static-responses)
      - [Computed responses](api‐zimic‐interceptor‐http#computed-responses)
  - [Intercepted HTTP resources](api‐zimic‐interceptor‐http#intercepted-http-resources)

- Explore the CLI:

  - [`zimic-interceptor browser`](cli‐zimic‐browser)
  - [`zimic-interceptor server`](cli‐zimic‐server)
