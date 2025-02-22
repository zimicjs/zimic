# Getting Started <!-- omit from toc -->

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
- [5. Create your first interceptor](#5-create-your-first-interceptor)
- [6. Next steps](#6-next-steps)

---

## 1. Requirements

### Supported environments

- If you are on **client-side**:
  - Any relatively modern browser (we recommend a recent version of a Chromium browser, such as
    [Chrome](https://www.google.com/chrome) or [Edge](https://www.microsoft.com/edge))
- If you are on **server-side**:
  - [Node](https://nodejs.org) >= 18.13.0
  - ~[Bun](https://bun.sh)~ ([:construction: coming soon :construction:](https://github.com/zimicjs/zimic/issues/51))
  - ~[Deno](https://deno.com)~
    ([ :construction: coming soon :construction:](https://github.com/zimicjs/zimic/issues/327))

### Supported languages

- [TypeScript](https://www.typescriptlang.org) >= 4.8
  - If you plan on using [`zimic-http typegen`](cli‐zimic‐typegen), we recommend
    [TypeScript](https://www.typescriptlang.org) >= 5.0.
- [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript) >= ES6
  - Zimic is fully functional on JavaScript, but consider using TypeScript for improved type safety and editor support.

If you are using TypeScript, we recommend enabling `strict` in your `tsconfig.json`:

```jsonc
{
  // ...
  "compilerOptions": {
    // ...
    "strict": true,
  },
}
```

## 2. Installation

Zimic is available on [npm](https://www.npmjs.com/package/zimic).

| Manager | Command                        |
| :-----: | ------------------------------ |
|   npm   | `npm install zimic --save-dev` |
|  pnpm   | `pnpm add zimic --dev`         |
|  yarn   | `yarn add zimic --dev`         |
|   bun   | `bun add zimic --dev`          |

We also canary releases under the tag `canary`, containing the latest features and bug fixes:

| Manager | Command                               |
| :-----: | ------------------------------------- |
|   npm   | `npm install zimic@canary --save-dev` |
|  pnpm   | `pnpm add zimic@canary --dev`         |
|  yarn   | `yarn add zimic@canary --dev`         |
|   bun   | `bun add zimic@canary --dev`          |

## 3. Post-install

### Client-side post-install

If you plan to use [local interceptors](#local-http-interceptors) and run Zimic in a browser, you must first
[initialize a mock service worker](cli‐zimic‐browser#zimic-browser-init) in your public directory. After that, you are
ready to start mocking!

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

## 5. Create your first interceptor

1. To start using Zimic, create your first [HTTP interceptor](../wiki/api‐zimic‐interceptor‐http.md#httpinterceptor):

   <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

   ```ts
   import { type HttpSchema } from '@zimic/http';
   import { httpInterceptor } from '@zimic/interceptor/http';

   // Declare your types:
   interface User {
     username: string;
   }

   interface RequestError {
     code: string;
     message: string;
   }

   // Declare your HTTP schema:
   // https://bit.ly/zimic-interceptor-http-schemas
   type MySchema = HttpSchema<{
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
           searchParams: {
             username?: string;
             limit?: `${number}`;
           };
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

   // Create your interceptor:
   // https://bit.ly/zimic-interceptor-http#httpinterceptorcreateoptions
   const myInterceptor = httpInterceptor.create<MySchema>({
     type: 'local',
     baseURL: 'http://localhost:3000',
     saveRequests: true, // Allow access to `handler.requests()`
   });
   ```

   </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

   ```ts
   import { type HttpSchema } from '@zimic/http';
   import { httpInterceptor } from '@zimic/interceptor/http';

   // Declare your types
   interface User {
     username: string;
   }

   interface RequestError {
     code: string;
     message: string;
   }

   // Declare your HTTP schema:
   // https://bit.ly/zimic-interceptor-http-schemas
   type MySchema = HttpSchema<{
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
           searchParams: {
             username?: string;
             limit?: `${number}`;
           };
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

   // Create your interceptor:
   // https://bit.ly/zimic-interceptor-http#httpinterceptorcreateoptions
   const myInterceptor = httpInterceptor.create<MySchema>({
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

   You can also use [`zimic-http typegen`](cli‐zimic‐typegen) to automatically generate types for your interceptor
   schema.

2. Then, manage your interceptor lifecycle:

   <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

   ```ts
   // https://bit.ly/zimic-guides-testing
   beforeAll(async () => {
     // Start intercepting requests:
     // https://bit.ly/zimic-interceptor-http#http-interceptorstart
     await myInterceptor.start();
   });

   beforeEach(() => {
     // Clear interceptors so that no tests affect each other:
     // https://bit.ly/zimic-interceptor-http#http-interceptorclear
     myInterceptor.clear();
   });

   afterEach(() => {
     // Check that all expected requests were made:
     // https://bit.ly/zimic-interceptor-http#http-interceptorchecktimes
     myInterceptor.checkTimes();
   });

   afterAll(async () => {
     // Stop intercepting requests:
     // https://bit.ly/zimic-interceptor-http#http-interceptorstop
     await myInterceptor.stop();
   });
   ```

   </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

   ```ts
   // https://bit.ly/zimic-guides-testing
   beforeAll(async () => {
     // Start intercepting requests:
     // https://bit.ly/zimic-interceptor-http#http-interceptorstart
     await myInterceptor.start();
   });

   beforeEach(() => {
     // Clear interceptors so that no tests affect each other:
     // https://bit.ly/zimic-interceptor-http#http-interceptorclear
     await myInterceptor.clear();
   });

   afterEach(() => {
     // Check that all expected requests were made:
     // https://bit.ly/zimic-interceptor-http#http-interceptorchecktimes
     await myInterceptor.checkTimes();
   });

   afterAll(async () => {
     // Stop intercepting requests:
     // https://bit.ly/zimic-interceptor-http#http-interceptorstop
     await myInterceptor.stop();
   });
   ```

   </details></td></tr></table>

   If you are [creating a remote interceptor](api‐zimic‐interceptor‐http#creating-a-remote-http-interceptor), it's
   necessary to have a running [interceptor server](cli‐zimic‐server#zimic-server-start) before starting it. The base
   URL of the remote interceptor should point to the server, optionally including a path to differentiate from other
   interceptors.

3. Now, you can intercept requests and return mock responses!

   <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

   ```ts
   test('example', async () => {
     const users: User[] = [{ username: 'my-user' }];

     // Declare your mocks:
     // https://bit.ly/zimic-interceptor-http#http-interceptormethodpath
     const myHandler = myInterceptor
       .get('/users')
       // Use restrictions to make declarative assertions and narrow down your mocks:
       // https://bit.ly/zimic-interceptor-http#http-handlerwithrestriction
       .with({
         headers: { authorization: 'Bearer my-token' },
         searchParams: { username: 'my' },
       })
       // Respond with your mock data:
       // https://bit.ly/zimic-interceptor-http#http-handlerresponddeclaration
       .respond({
         status: 200,
         body: users,
       })
       // Define how many requests you expect your application to make:
       // https://bit.ly/zimic-interceptor-http#http-handlertimes
       .times(1);

     // Run your application and make requests:
     // ...

     // Check the requests you expect:
     // https://bit.ly/zimic-interceptor-http#http-handlerrequests
     //
     // NOTE: The code below checks the requests manually. This is optional in this
     // example because the `with` and `times` calls act as a declarative validation,
     // meaning that exactly one request is expected with specific data. If fewer or
     // more requests are received, the test will fail when `myInterceptor.checkTimes()`
     // is called in the `afterEach` hook.
     const requests = myHandler.requests();
     expect(requests).toHaveLength(1);

     expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

     expect(requests[0].searchParams.size).toBe(1);
     expect(requests[0].searchParams.get('username')).toBe('my');

     expect(requests[0].body).toBe(null);
   });
   ```

   </details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

   ```ts
   test('example', async () => {
     const users: User[] = [{ username: 'my-user' }];

     // Declare your mocks:
     // https://bit.ly/zimic-interceptor-http#http-interceptormethodpath
     const myHandler = await myInterceptor
       .get('/users')
       // Use restrictions to make declarative assertions and narrow down your mocks:
       // https://bit.ly/zimic-interceptor-http#http-handlerwithrestriction
       .with({
         headers: { authorization: 'Bearer my-token' },
         searchParams: { username: 'my' },
       })
       // Respond with your mock data:
       // https://bit.ly/zimic-interceptor-http#http-handlerresponddeclaration
       .respond({
         status: 200,
         body: users,
       })
       // Define how many requests you expect your application to make:
       // https://bit.ly/zimic-interceptor-http#http-handlertimes
       .times(1);

     // Run your application and make requests:
     // ...

     // Check the requests you expect:
     // https://bit.ly/zimic-interceptor-http#http-handlerrequests
     //
     // NOTE: The code below checks the requests manually. This is optional in this
     // example because the `with` and `times` calls act as a declarative validation,
     // meaning that exactly one request is expected with specific data. If fewer or
     // more requests are received, the test will fail when `myInterceptor.checkTimes()`
     // is called in the `afterEach` hook.
     const requests = await myHandler.requests();
     expect(requests).toHaveLength(1);

     expect(requests[0].headers.get('authorization')).toBe('Bearer my-token');

     expect(requests[0].searchParams.size).toBe(1);
     expect(requests[0].searchParams.get('username')).toBe('my');

     expect(requests[0].body).toBe(null);
   });
   ```

   </details></td></tr></table>

## 6. Next steps

- Take a look at our [examples](../../examples/README.md) and [testing guide](guides‐testing).

- Check out the [API reference](api‐zimic):

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
  - [Declaring HTTP interceptor schemas](api‐zimic‐interceptor‐http‐schemas)

- Explore the [`zimic` CLI](cli‐zimic):

  - [`zimic-interceptor browser`](cli‐zimic‐browser)
  - [`zimic-interceptor server`](cli‐zimic‐server)
  - [`zimic-http typegen`](cli‐zimic‐typegen)
