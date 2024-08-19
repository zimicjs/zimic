# Contents <!-- omit from toc -->

- [Getting started](#getting-started)
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

# Getting started

## 1. Requirements

### Supported environments

- If you are on **client-side**:
  - Any relatively modern browser (we recommend a recent version of a Chromium browser, such as
    [Chrome](https://www.google.com/chrome) or [Edge](https://www.microsoft.com/edge))
- If you are on **server-side**:
  - [Node](https://nodejs.org) >= 18.13.0
  - ~Bun~ ([:construction: coming soon :construction:](https://github.com/zimicjs/zimic/issues/51))
  - ~Deno~ ([ :construction: coming soon :construction:](https://github.com/zimicjs/zimic/issues/51))

### Supported languages

- [TypeScript](https://www.typescriptlang.org) >= 4.7
  - If you plan on using [`zimic typegen`](cli-zimic-typegen), we recommend
    [TypeScript](https://www.typescriptlang.org) >= 5.0.
- [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) >= ES6
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
[initialize a mock service worker](cli-zimic-browser#zimic-browser-init) in your public directory. After that, you are
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

Our [Vitest](../../examples#vitest), [Jest](../../examples#jest), and [Next.js Pages Router](../../examples#nextjs)
examples use local interceptors.

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

When an interceptor is `remote`, Zimic uses a dedicated local [interceptor server](cli-zimic-server#zimic-server) to
handle requests. This opens up more possibilities for mocking, such as handling requests from multiple applications. It
is also more robust because it uses a regular HTTP server and does not depend on local interception algorithms.

Our [Playwright](../../examples#playwright) and [Next.js App Router](../../examples#nextjs) examples use remote
interceptors.

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

1. To start using Zimic, create your first [HTTP interceptor](../wiki/api-zimic-interceptor-http.md#httpinterceptor):

   <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

   ```ts
   import { JSONValue } from 'zimic';
   import { httpInterceptor } from 'zimic/interceptor/http';

   type User = JSONValue<{
     username: string;
   }>;

   const interceptor = httpInterceptor.create<{
     '/users': {
       GET: {
         response: {
           200: { body: User[] };
         };
       };
     };
   }>({
     type: 'local',
     baseURL: 'http://localhost:3000',
   });
   ```

   </details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

   ```ts
   import { JSONValue } from 'zimic';
   import { httpInterceptor } from 'zimic/interceptor/http';

   type User = JSONValue<{
     username: string;
   }>;

   const interceptor = httpInterceptor.create<{
     '/users': {
       GET: {
         response: {
           200: { body: User[] };
         };
       };
     };
   }>({
     type: 'remote',
     // The interceptor server is at http://localhost:4000
     baseURL: 'http://localhost:4000/my-service',
   });
   ```

   </details></td></tr></table>

   In this example, we're [creating an interceptor](api-zimic-interceptor-http#httpinterceptorcreateoptions) for a
   service supporting `GET` requests to `/users`. A successful response contains an array of `User` objects. Learn more
   about declaring [HTTP service schemas](api-zimic-http-schemas).

   You can also use [`zimic typegen`](cli-zimic-typegen) to automatically generate these types from an
   [OpenAPI 3](https://swagger.io/specification) schema.

2. Then, start the interceptor:

   ```ts
   await interceptor.start();
   ```

   If you are [creating a remote interceptor](api-zimic-interceptor-http#creating-a-remote-http-interceptor), it's
   necessary to have a running [interceptor server](cli-zimic-server#zimic-server-start) before starting it. The base
   URL of the remote interceptor should point to the server, optionally including a path to differentiate from other
   interceptors.

3. Now, you can intercept requests and return mock responses!

   <table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

   ```ts
   const listHandler = interceptor.get('/users').respond({
     status: 200,
     body: [{ username: 'diego-aquino' }],
   });

   const response = await fetch('http://localhost:3000/users');
   const users = await response.json();
   console.log(users); // [{ username: 'diego-aquino' }]

   const requests = listHandler.requests();
   console.log(requests.length); // 1
   ```

   </details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

   ```ts
   const listHandler = await interceptor.get('/users').respond({
     status: 200,
     body: [{ username: 'diego-aquino' }],
   });

   const response = await fetch('http://localhost:3000/users');
   const users = await response.json();
   console.log(users); // [{ username: 'diego-aquino' }]

   const requests = await listHandler.requests();
   console.log(requests.length); // 1
   ```

   </details></td></tr></table>

## 6. Next steps

- Take a look at our [examples](../../examples/README.md) and [testing guide](guides-testing).

- Check out the [API reference](api-zimic):

  - [`HttpInterceptor`](api-zimic-interceptor-http#httpinterceptor)
    - [Creating a local HTTP interceptor](api-zimic-interceptor-http#creating-a-local-http-interceptor)
    - [Creating a remote HTTP interceptor](api-zimic-interceptor-http#creating-a-remote-http-interceptor)
    - [Managing unhandled requests](api-zimic-interceptor-http#unhandled-requests)
    - [Saving intercepted requests](api-zimic-interceptor-http#saving-requests)
    - [`HttpInterceptor` utility types](api-zimic-interceptor-http#httpinterceptor-utility-types)
  - [`HttpRequestHandler`](api-zimic-interceptor-http#httprequesthandler)
    - [Declaring restrictions](api-zimic-interceptor-http#http-handlerwithrestriction)
      - [Static restrictions](api-zimic-interceptor-http#static-restrictions)
      - [Computed restrictions](api-zimic-interceptor-http#computed-restrictions)
    - [Declaring responses](api-zimic-interceptor-http#http-handlerresponddeclaration)
      - [Static responses](api-zimic-interceptor-http#static-responses)
      - [Computed responses](api-zimic-interceptor-http#computed-responses)
  - [Intercepted HTTP resources](api-zimic-interceptor-http#intercepted-http-resources)
  - [Declaring HTTP service schemas](api-zimic-http-schemas)

- Explore the [`zimic` CLI](cli-zimic):

  - [`zimic browser`](cli-zimic-browser)
  - [`zimic server`](cli-zimic-server)
  - [`zimic typegen`](cli-zimic-typegen)
