<p align="center">
  <img src="./docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  Zimic
</h1>

<p align="center">
  Next-gen, TypeScript-first HTTP request mocking
</p>

<div align="center">
  <a href="https://www.npmjs.com/package/zimic">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#table-of-contents">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues/new">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/5">Roadmap</a>
</div>

---

Zimic is a lightweight, thoroughly tested, TypeScript-first HTTP request mocking library, inspired by
[Zod](https://github.com/colinhacks/zod)'s type inference and using [MSW](https://github.com/mswjs/msw) under the hood.

## Features

Zimic provides a flexible and type-safe way to mock HTTP requests.

- :zap: **Statically-typed mocks**. Declare your HTTP endpoints and get full type inference and validation when applying
  mocks.
- :link: **Network-level intercepts**. Internally, Zimic uses [MSW](https://github.com/mswjs/msw), which intercepts HTTP
  requests right _before_ they leave your app. This means that no parts of your code are stubbed or skipped. From you
  application's point of view, the mocked requests are indistinguishable from the real ones.
- :wrench: **Flexibility**. You can simulate real application workflows by mocking the necessary endpoints. This is
  specially useful in testing, making sure that the real path your application takes is covered.
- :bulb: **Simplicity**. Zimic was designed from scratch to encourage clarity and simplicity in your mocks. Check our
  [getting started guide](#getting-started) and starting mocking!

---

## Table of contents

- [Features](#features)
- [Table of contents](#table-of-contents)
- [Getting started](#getting-started)
  - [1. Requirements](#1-requirements)
  - [2. Install from `npm`](#2-install-from-npm)
  - [3. Choose your method to intercept requests](#3-choose-your-method-to-intercept-requests)
    - [Local HTTP interceptors](#local-http-interceptors)
    - [Remote HTTP interceptors](#remote-http-interceptors)
  - [4. Post-install](#4-post-install)
    - [Node.js post-install](#nodejs-post-install)
    - [Browser post-install](#browser-post-install)
- [Examples](#examples)
- [Usage](#usage)
  - [Basic usage](#basic-usage)
  - [Testing](#testing)
- [`zimic` API reference](#zimic-api-reference)
  - [`HttpHeaders`](#httpheaders)
    - [Comparing `HttpHeaders`](#comparing-httpheaders)
  - [`HttpSearchParams`](#httpsearchparams)
    - [Comparing `HttpSearchParams`](#comparing-httpsearchparams)
- [`zimic/interceptor` API reference](#zimicinterceptor-api-reference)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`http.createInterceptor`](#httpcreateinterceptor)
      - [Creating a local HTTP interceptor](#creating-a-local-http-interceptor)
      - [Creating a remote HTTP interceptor](#creating-a-remote-http-interceptor)
      - [Unhandled requests](#unhandled-requests)
    - [Declaring HTTP service schemas](#declaring-http-service-schemas)
      - [Declaring HTTP paths](#declaring-http-paths)
      - [Declaring HTTP methods](#declaring-http-methods)
      - [Declaring HTTP requests](#declaring-http-requests)
      - [Declaring HTTP responses](#declaring-http-responses)
    - [HTTP `interceptor.start()`](#http-interceptorstart)
    - [HTTP `interceptor.stop()`](#http-interceptorstop)
    - [HTTP `interceptor.isRunning()`](#http-interceptorisrunning)
    - [HTTP `interceptor.baseURL()`](#http-interceptorbaseurl)
    - [HTTP `interceptor.platform()`](#http-interceptorplatform)
    - [HTTP `interceptor.<method>(path)`](#http-interceptormethodpath)
      - [Dynamic path parameters](#dynamic-path-parameters)
    - [HTTP `interceptor.clear()`](#http-interceptorclear)
  - [`HttpRequestHandler`](#httprequesthandler)
    - [HTTP `handler.method()`](#http-handlermethod)
    - [HTTP `handler.path()`](#http-handlerpath)
    - [HTTP `handler.with(restriction)`](#http-handlerwithrestriction)
      - [Static restrictions](#static-restrictions)
      - [Computed restrictions](#computed-restrictions)
    - [HTTP `handler.respond(declaration)`](#http-handlerresponddeclaration)
      - [Static responses](#static-responses)
      - [Computed responses](#computed-responses)
    - [HTTP `handler.bypass()`](#http-handlerbypass)
    - [HTTP `handler.clear()`](#http-handlerclear)
    - [HTTP `handler.requests()`](#http-handlerrequests)
- [CLI](#cli)
  - [`zimic`](#zimic)
  - [`zimic browser`](#zimic-browser)
    - [`zimic browser init`](#zimic-browser-init)
  - [`zimic server`](#zimic-server)
    - [`zimic server start`](#zimic-server-start)
    - [Programmatic usage](#programmatic-usage)
- [Changelog](#changelog)

## Getting started

### 1. Requirements

- [TypeScript](https://www.typescriptlang.org) >= 4.7

- `strict` mode enabled in your `tsconfig.json`:
  ```jsonc
  {
    // ...
    "compilerOptions": {
      // ...
      "strict": true,
    },
  }
  ```

### 2. Install from `npm`

| Manager | Command                        |
| :-----: | ------------------------------ |
|   npm   | `npm install zimic --save-dev` |
|  pnpm   | `pnpm add zimic --dev`         |
|  yarn   | `yarn add zimic --dev`         |
|   bun   | `bun add zimic --dev`          |

The latest (possibly unstable) code is available in canary releases, under the tag `canary`:

| Manager | Command                               |
| :-----: | ------------------------------------- |
|   npm   | `npm install zimic@canary --save-dev` |
|  pnpm   | `pnpm add zimic@canary --dev`         |
|  yarn   | `yarn add zimic@canary --dev`         |
|   bun   | `bun add zimic@canary --dev`          |

### 3. Choose your method to intercept requests

Zimic interceptors support two types of execution: `local` and `remote`.

#### Local HTTP interceptors

When the type of an interceptor is `local`, Zimic uses [MSW](https://github.com/mswjs/msw) to intercept requests created
_in the same process_ as your application. This is the simplest way to start mocking requests and does not require any
server setup.

When to use `local`:

- **Testing**: If you run your application in the _same_ process as your tests. This is common when using Jest, Vitest
  and other test runners for unit and integration tests.
- **Development**: If you want to mock requests in your development environment without setting up a server. This might
  be useful when you're working on a feature that requires a backend that is not yet ready.

Our [Vitest](./examples/README.md#vitest), [Jest](./examples/README.md#jest), and
[Next.js Pages Router](./examples/README.md#nextjs) examples use local interceptors.

> [!NOTE]
>
> All mocking operations in local interceptor are _synchronous_. There's no need to `await` them before making requests.

#### Remote HTTP interceptors

When the type of an interceptor is `remote`, Zimic uses a dedicated [interceptor server](#zimic-server) to handle
requests. This opens up more possibilities for mocking, such as intercepting requests from multiple applications and
running the interceptor server on a different machine. It is also more robust because it uses a regular HTTP server and
does not depend on local interception algorithms.

When to use `remote`:

- **Testing**: If you _do not_ run your application in the same process as your tests. When using Cypress, Playwright,
  or other end-to-end testing tools, this is generally the case because the test runner and the application run in
  separate processes. This might also happen in more complex setups with Jest, Vitest and other test runners, such as
  testing a backend server running in another process, terminal, or machine.
- **Development**: If you want your mocked responses to be accessible by other processes in your local network (e.g.
  browser, app, `curl`) . A common scenario is to create a mock server along with a script to apply the mocks. After
  started, the server can be accessed by other applications and return mock responses.

Our [Playwright](./examples/README.md#playwright) and [Next.js App Router](./examples/README.md#nextjs) examples use
remote interceptors. See [Next.js App Router - Loading mocks](./examples/with-next-js-app/README.md#loading-mocks) and
[Playwright - Loading mocks](./examples/with-playwright/README.md#loading-mocks) for examples on how to load mocks
before starting the application in development.

> [!NOTE]
>
> All mocking operations in remote interceptors are _asynchronous_. Make sure to `await` them before making requests.
>
> Some code snippets are displayed side by side with a local and a remote interceptor example. Generally, the remote
> snippets differ only by adding `await` when necessary.
>
> If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is
> [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks
> unhandled promises, avoiding forgetting to `await` remote interceptor operations.

> [!TIP]
>
> The type is an individual interceptor configuration. It is perfectly possible to have multiple interceptors with
> different types in the same application! However, keep in mind that local interceptors have preference over remote
> interceptors.

### 4. Post-install

#### Node.js post-install

No additional configuration is necessary for Node.js. Check out the [usage guide](#usage) and start mocking!

#### Browser post-install

If you plan to use [local interceptors](#local-http-interceptors) and run Zimic in a browser, you must first
[initialize a mock service worker](#zimic-browser-init) in your public directory. After that, you are ready to
[start mocking](#usage)!

## Examples

Visit our [examples](./examples) to see how to use Zimic with popular frameworks and libraries!

## Usage

### Basic usage

1. To start using Zimic, create your first [HTTP interceptor](#httpinterceptor):

   <table><tr><td valign="top"><details open><summary><b>Local</b></summary>

   ```ts
   import { JSONValue } from 'zimic';
   import { http } from 'zimic/interceptor';

   type User = JSONValue<{
     username: string;
   }>;

   const interceptor = http.createInterceptor<{
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

   </details></td><td valign="top"><details open><summary><b>Remote</b></summary>

   ```ts
   import { JSONValue } from 'zimic';
   import { http } from 'zimic/interceptor';

   type User = JSONValue<{
     username: string;
   }>;

   const interceptor = http.createInterceptor<{
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

In this example, we're [creating an interceptor](#httpcreateinterceptor) for a service supporting `GET` requests to
`/users`. A successful response contains an array of `User` objects. Learn more about
[declaring HTTP service schemas](#declaring-http-service-schemas).

1. Then, start the interceptor:

   ```ts
   await interceptor.start();
   ```

   If you are [creating a remote interceptor](#creating-a-remote-http-interceptor), it's necessary to have a running
   [interceptor server](#zimic-server-start) before starting it. The base URL of the remote interceptor should point to
   the server, optionally including a path to differentiate from other interceptors.

2. Now, you can intercept requests and return mock responses!

   <table><tr><td valign="top"><details open><summary><b>Local</b></summary>

   ```ts
   const listHandler = interceptor.get('/users').respond({
     status: 200,
     body: [{ username: 'diego-aquino' }],
   });

   const response = await fetch('http://localhost:3000/users');
   const users = await response.json();
   console.log(users); // [{ username: 'diego-aquino' }]
   ```

   </details></td><td valign="top"><details open><summary><b>Remote</b></summary>

   ```ts
   const listHandler = await interceptor.get('/users').respond({
     status: 200,
     body: [{ username: 'diego-aquino' }],
   });

   const response = await fetch('http://localhost:3000/users');
   const users = await response.json();
   console.log(users); // [{ username: 'diego-aquino' }]
   ```

   </details></td></tr></table>

More usage examples and recommendations are available in our [examples](#examples) and the
[`zimic/interceptor` API reference](#zimicinterceptor-api-reference).

### Testing

We recommend managing the lifecycle of your interceptors using `beforeAll` and `afterAll`, or equivalent hooks, in your
test setup file. An example using a Jest/Vitest API:

`tests/setup.ts`

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
// Your interceptors
const interceptors = [userInterceptor, analyticsInterceptor];

// Start intercepting requests
beforeAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.start();
  }
});

// Clear all interceptors so that no tests affect each other
beforeEach(() => {
  for (const interceptor of interceptors) {
    interceptor.clear();
  }
});

// Stop intercepting requests
afterAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
});
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
// Your interceptors
const interceptors = [userInterceptor, analyticsInterceptor];

// Start intercepting requests
beforeAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.start();
  }
});

// Clear all interceptors so that no tests affect each other
beforeEach(async () => {
  for (const interceptor of interceptors) {
    await interceptor.clear();
  }
});

// Stop intercepting requests
afterAll(async () => {
  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
});
```

</details></td></tr></table>

---

## `zimic` API reference

This module provides general resources, such as HTTP classes and types.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

### `HttpHeaders`

A superset of the built-in [`Headers`](https://developer.mozilla.org/docs/Web/API/Headers) class, with a strictly-typed
schema. `HttpHeaders` is fully compatible with `Headers` and is used by Zimic to provide type safety when managing
headers.

<details>
  <summary><code>HttpHeaders</code> example:</summary>

```ts
import { HttpHeaders } from 'zimic';

const headers = new HttpHeaders<{
  accept?: string;
  'content-type'?: string;
}>({
  accept: '*/*',
  'content-type': 'application/json',
});

const contentType = headers.get('content-type');
console.log(contentType); // 'application/json'
```

</details>

#### Comparing `HttpHeaders`

`HttpHeaders` also provide the utility methods `headers.equals()` and `headers.contains()`, useful in comparisons with
other headers:

<details>
  <summary>Comparing <code>HttpHeaders</code> example:</summary>

```ts
import { HttpSchema, HttpHeaders } from 'zimic';

type HeaderSchema = HttpSchema.Headers<{
  accept?: string;
  'content-type'?: string;
}>;

const headers1 = new HttpHeaders<HeaderSchema>({
  accept: '*/*',
  'content-type': 'application/json',
});

const headers2 = new HttpHeaders<HeaderSchema>({
  accept: '*/*',
  'content-type': 'application/json',
});

const headers3 = new HttpHeaders<
  HeaderSchema & {
    'x-custom-header'?: string;
  }
>({
  accept: '*/*',
  'content-type': 'application/json',
  'x-custom-header': 'value',
});

console.log(headers1.equals(headers2)); // true
console.log(headers1.equals(headers3)); // false

console.log(headers1.contains(headers2)); // true
console.log(headers1.contains(headers3)); // false
console.log(headers3.contains(headers1)); // true
```

</details>

### `HttpSearchParams`

A superset of the built-in [`URLSearchParams`](https://developer.mozilla.org/docs/Web/API/URLSearchParams) class, with a
strictly-typed schema. `HttpSearchParams` is fully compatible with `URLSearchParams` and is used by Zimic to provide
type safety when applying mocks.

<details>
  <summary><code>HttpSearchParams</code> example:</summary>

```ts
import { HttpSearchParams } from 'zimic';

const searchParams = new HttpSearchParams<{
  names?: string[];
  page?: `${number}`;
}>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const names = searchParams.getAll('names');
console.log(names); // ['user 1', 'user 2']

const page = searchParams.get('page');
console.log(page); // '1'
```

</details>

#### Comparing `HttpSearchParams`

`HttpSearchParams` also provide the utility methods `searchParams.equals()` and `searchParams.contains()`, useful in
comparisons with other search params:

<details>
  <summary>Comparing <code>HttpSearchParams</code> example:</summary>

```ts
import { HttpSchema, HttpSearchParams } from 'zimic';

type SearchParamsSchema = HttpSchema.SearchParams<{
  names?: string[];
  page?: `${number}`;
}>;

const searchParams1 = new HttpSearchParams<SearchParamsSchema>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const searchParams2 = new HttpSearchParams<SearchParamsSchema>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const searchParams3 = new HttpSearchParams<
  SearchParamsSchema & {
    orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}[]`;
  }
>({
  names: ['user 1', 'user 2'],
  page: '1',
  orderBy: ['name.asc'],
});

console.log(searchParams1.equals(searchParams2)); // true
console.log(searchParams1.equals(searchParams3)); // false

console.log(searchParams1.contains(searchParams2)); // true
console.log(searchParams1.contains(searchParams3)); // false
console.log(searchParams3.contains(searchParams1)); // true
```

</details>

## `zimic/interceptor` API reference

This module provides resources to create HTTP interceptors for both Node.js and browser environments.

### `HttpInterceptor`

HTTP interceptors provide the main API to handle HTTP requests and return mock responses. The methods, paths, status
codes, parameters, and responses are statically-typed based on the service schema.

Each interceptor represents a service and can be used to mock its paths and methods.

#### `http.createInterceptor`

Creates an HTTP interceptor, the main interface to intercept HTTP requests and return responses. Learn more about
[declaring service schemas](#declaring-http-service-schemas).

##### Creating a local HTTP interceptor

A local interceptor is configured with `type: 'local'`. The `baseURL` represents the URL should be matched by this
interceptor. Any request starting with the `baseURL` will be intercepted if a matching [handler](#httprequesthandler)
exists.

```ts
import { JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type User = JSONValue<{
  username: string;
}>;

const interceptor = http.createInterceptor<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

##### Creating a remote HTTP interceptor

A remote interceptor is configured with `type: 'remote'`. The `baseURL` points to an
[interceptor server](#zimic-server). Any request starting with the `baseURL` will be intercepted if a matching
[handler](#httprequesthandler) exists.

```ts
import { JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type User = JSONValue<{
  username: string;
}>;

const interceptor = http.createInterceptor<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  // The interceptor server is at http://localhost:4000
  // `/my-service` is a path to differentiate from other interceptors using the same server
  type: 'remote',
  baseURL: 'http://localhost:4000/my-service',
});
```

A single [interceptor server](#zimic-server) is perfectly capable of handling multiple interceptors and requests. Thus,
additional paths are supported and might be necessary to differentiate between conflicting interceptors. If you may have
multiple threads or processes applying mocks concurrently to the same [interceptor server](#zimic-server), it's
important to keep the interceptor base URLs unique. Also, make sure that your application is considering the correct URL
when making requests.

```ts
const interceptor = http.createInterceptor<{
  // ...
}>({
  type: 'remote',
  // Declaring a base URL with a unique identifier to prevent conflicts
  baseURL: `http://localhost:4000/my-service-${crypto.randomUUID()}`,
});

// Your application should use this base URL when making requests
const baseURL = interceptor.baseURL();
```

##### Unhandled requests

When a request is not matched by any interceptor handlers, it is considered unhandled and will be logged to the console
by default.

> [!TIP]
>
> If you expected a request to be handled, but it was not, make sure that the interceptor
> [base URL](#httpcreateinterceptor), [path](#http-interceptormethodpath), [method](#http-interceptormethodpath), and
> [restrictions](#http-handlerwithrestriction) correctly match the request. Additionally, confirm that no errors
> occurred while creating the response.

In a [local interceptor](#local-http-interceptors), unhandled requests are always bypassed, meaning that they pass
through the interceptor and reach the real network. [Remote interceptors](#remote-http-interceptors) in pair with an
[interceptor server](#zimic-server) always reject unhandled requests because they cannot be bypassed.

You can override the default logging behavior per interceptor with `onUnhandledRequest` in `http.createInterceptor()`.

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  onUnhandledRequest: { log: false },
});
```

`onUnhandledRequest` also accepts a function to dynamically choose when to ignore an unhandled request. Calling
`await context.log()` logs the request to the console.

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  onUnhandledRequest: async (request, context) => {
    const url = new URL(request.url);

    // Ignore only unhandled requests to /assets
    if (!url.pathname.startsWith('/assets')) {
      await context.log();
    }
  },
});
```

If you want to override the default logging behavior for all interceptors, or requests that did not match any known base
URL, you can use `http.default.onUnhandledRequest`. Keep in mind that defining an `onUnhandledRequest` when creating an
interceptor will take precedence over `http.default.onUnhandledRequest`.

```ts
import { http } from 'zimic/interceptor';

// Example 1: Ignore all unhandled requests
http.default.onUnhandledRequest({ log: false });

// Example 2: Ignore only unhandled requests to /assets
http.default.onUnhandledRequest((request, context) => {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/assets')) {
    await context.log();
  }
});
```

#### Declaring HTTP service schemas

HTTP service schemas define the structure of the real services being used. This includes paths, methods, request and
response bodies, and status codes. Based on the schema, interceptors will provide type validation when applying mocks.

<details>
  <summary>An example of a complete interceptor schema:</summary>

```ts
import { HttpSchema, JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

// Declaring base types
type User = JSONValue<{
  username: string;
}>;

type UserCreationBody = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

type UserListSearchParams = HttpSchema.SearchParams<{
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}>;

// Creating the interceptor
const interceptor = http.createInterceptor<{
  '/users': {
    POST: {
      request: {
        headers: { accept: string };
        body: UserCreationBody;
      };
      response: {
        201: {
          headers: { 'content-type': string };
          body: User;
        };
      };
    };
    GET: {
      request: {
        searchParams: UserListSearchParams;
      };
      response: {
        200: { body: User[] };
        404: { body: NotFoundError };
      };
    };
  };

  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>Alternatively, you can compose the schema using utility types:</summary>

```ts
import { HttpSchema, JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

// Declaring the base types
type User = JSONValue<{
  username: string;
}>;

type UserCreationBody = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

type UserListSearchParams = HttpSchema.SearchParams<{
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}>;

// Declaring user methods
type UserMethods = HttpSchema.Methods<{
  POST: {
    request: {
      headers: { accept: string };
      body: UserCreationBody;
    };
    response: {
      201: {
        headers: { 'content-type': string };
        body: User;
      };
    };
  };

  GET: {
    request: {
      searchParams: UserListSearchParams;
    };
    response: {
      200: { body: User[] };
      404: { body: NotFoundError };
    };
  };
}>;

type UserByIdMethods = HttpSchema.Methods<{
  GET: {
    response: {
      200: { body: User };
      404: { body: NotFoundError };
    };
  };
}>;

// Declaring user paths
type UserPaths = HttpSchema.Paths<{
  '/users': UserMethods;
}>;

type UserByIdPaths = HttpSchema.Paths<{
  '/users/:id': UserByIdMethods;
}>;

// Declaring interceptor schema
type ServiceSchema = UserPaths & UserByIdPaths;

// Creating the interceptor
const interceptor = http.createInterceptor<ServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP paths

At the root level, each key represents a path or route of the service:

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<{
  '/users': {
    // Path schema
  };
  '/users/:id': {
    // Path schema
  };
  '/posts': {
    // Path schema
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

<details>
  <summary>
    Alternatively, you can also compose paths using the utility type <code>HttpSchema.Paths</code>:
  </summary>

```ts
import { HttpSchema } from 'zimic';
import { http } from 'zimic/interceptor';

type UserPaths = HttpSchema.Paths<{
  '/users': {
    // Path schema
  };
  '/users/:id': {
    // Path schema
  };
}>;

type PostPaths = HttpSchema.Paths<{
  '/posts': {
    // Path schema
  };
}>;

const interceptor = http.createInterceptor<UserPaths & PostPaths>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP methods

Each path can have one or more methods, (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`). The method
names are case-sensitive.

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<{
  '/users': {
    GET: {
      // Method schema
    };
    POST: {
      // Method schema
    };
  };
  // Other paths
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

<details>
  <summary>
    Similarly to <a href="#declaring-http-paths">paths</a>, you can also compose methods using the utility type
    <code>HttpSchema.Methods</code>:
  </summary>

```ts
import { HttpSchema } from 'zimic';
import { http } from 'zimic/interceptor';

type UserMethods = HttpSchema.Methods<{
  GET: {
    // Method schema
  };
  POST: {
    // Method schema
  };
}>;

const interceptor = http.createInterceptor<{
  '/users': UserMethods;
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP requests

Each method can have a `request`, which defines the schema of the accepted requests. `headers`, `searchParams`, and
`body` are supported to provide type safety when applying mocks. [Path parameters](#dynamic-path-parameters) are
automatically inferred from dynamic paths, such as `/users/:id`.

```ts
import { HttpSchema, JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type UserCreationBody = JSONValue<{
  username: string;
}>;

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = http.createInterceptor<{
  '/users': {
    POST: {
      request: {
        body: UserCreationBody;
      };
      // ...
    };

    GET: {
      request: {
        searchParams: UserListSearchParams;
      };
      // ...
    };
    // Other methods
  };
  // Other paths
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

> [!TIP]
>
> You only need to include in the schema the properties you want to use in your mocks. Headers, search params, or body
> fields that are not used do not need to be declared, keeping your type definitions clean and concise.

> [!IMPORTANT]
>
> Body types cannot be declared using the keyword `interface`, because interfaces do not have implicit index signatures
> as types do. Part of Zimic's JSON validation relies on index signatures. To workaround this, you can declare bodies
> using `type`. As an extra step to make sure the type is a valid JSON, you can use the utility type `JSONValue`.

<details>
  <summary>
    You can also compose requests using the utility type <code>HttpSchema.Request</code>, similarly to
    <a href="#declaring-http-methods">methods</a>:
  </summary>

```ts
import { HttpSchema, JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type UserCreationBody = JSONValue<{
  username: string;
}>;

type UserCreationRequest = HttpSchema.Request<{
  body: UserCreationBody;
}>;

const interceptor = http.createInterceptor<{
  '/users': {
    POST: {
      request: UserCreationRequest;
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP responses

Each method can also have a `response`, which defines the schema of the returned responses. The status codes are used as
keys. `headers` and `body` are supported to provide type safety when applying mocks.

```ts
import { JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type User = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

const interceptor = http.createInterceptor<{
  '/users/:id': {
    GET: {
      // ...
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
    // Other methods
  };
  // Other paths
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

> [!TIP]
>
> Similarly to [declaring HTTP requests](#declaring-http-requests), you only need to include in the schema the
> properties you want to use in your mocks. Headers, search params, or body fields that are not used do not need to be
> declared, keeping your type definitions clean and concise.

> [!IMPORTANT]
>
> Also similarly to [declaring HTTP requests](#declaring-http-requests), body types cannot be declared using the keyword
> `interface`, because interfaces do not have implicit index signatures as types do. Part of Zimic's JSON validation
> relies on index signatures. To workaround this, you can declare bodies using `type`. As an extra step to make sure the
> type is a valid JSON, you can use the utility type `JSONValue`.

<details>
  <summary>
    You can also compose responses using the utility types <code>HttpSchema.ResponseByStatusCode</code> and
    <code>HttpSchema.Response</code>, similarly to <a href="#declaring-http-requests">requests</a>:
  </summary>

```ts
import { HttpSchema, JSONValue } from 'zimic';
import { http } from 'zimic/interceptor';

type User = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

type SuccessUserGetResponse = HttpSchema.Response<{
  body: User;
}>;

type NotFoundUserGetResponse = HttpSchema.Response<{
  body: NotFoundError;
}>;

type UserGetResponses = HttpSchema.ResponseByStatusCode<{
  200: SuccessUserGetResponse;
  404: NotFoundUserGetResponse;
}>;

const interceptor = http.createInterceptor<{
  '/users/:id': {
    GET: {
      response: UserGetResponses;
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

#### HTTP `interceptor.start()`

Starts the interceptor. Only interceptors that are running will intercept requests.

```ts
await interceptor.start();
```

When targeting a browser environment with a local interceptor, make sure to follow the
[browser post-install guide](#browser-post-install) before starting your interceptors.

#### HTTP `interceptor.stop()`

Stops the interceptor. Stopping an interceptor will also clear its registered handlers and responses.

```ts
await interceptor.stop();
```

#### HTTP `interceptor.isRunning()`

Returns whether the interceptor is currently running and ready to use.

```ts
const isRunning = interceptor.isRunning();
```

#### HTTP `interceptor.baseURL()`

Returns the base URL of the interceptor.

```ts
const baseURL = interceptor.baseURL();
```

#### HTTP `interceptor.platform()`

Returns the platform used by the interceptor (`browser` or `node`).

```ts
const platform = interceptor.platform();
```

#### HTTP `interceptor.<method>(path)`

Creates an [`HttpRequestHandler`](#httprequesthandler) for the given method and path. The path and method must be
declared in the interceptor schema.

The supported methods are: `get`, `post`, `put`, `patch`, `delete`, `head`, and `options`.

When using a [remote interceptor](#remote-http-interceptors), creating a handler is an asynchronous operation, so you
need to `await` it. You can also chain any number of operations and apply them by awaiting the handler.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<{
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

const listHandler = interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  type: 'remote',
  baseURL: 'http://localhost:4000/my-service',
});

const listHandler = await interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr></table>

##### Dynamic path parameters

Paths with dynamic path parameters are supported, such as `/users/:id`. Even when using a computed path (e.g.
`/users/1`), the original path is automatically inferred, guaranteeing type safety.

```ts
import { http } from 'zimic/interceptor';

const interceptor = http.createInterceptor<{
  '/users/:id': {
    PUT: {
      request: {
        body: { username: string };
      };
      response: {
        204: {};
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

interceptor.get('/users/:id'); // Matches any id
interceptor.get(`/users/${1}`); // Only matches id 1
```

`request.pathParams` contains the parsed path parameters of a request and have their type automatically inferred from
the path string. For example, the path `/users/:userId` will result in a `request.pathParams` of type
`{ userId: string }`.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const updateHandler = interceptor.put('/users/:id').respond((request) => {
  console.log(request.pathParams); // { id: '1' }

  return {
    status: 200,
    body: { username: 'diego-aquino' },
  };
});

await fetch('http://localhost:3000/users/1', { method: 'PUT' });
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const updateHandler = await interceptor.put('/users/:id').respond((request) => {
  console.log(request.pathParams); // { id: '1' }

  return {
    status: 200,
    body: { username: 'diego-aquino' },
  };
});

await fetch('http://localhost:3000/users/1', { method: 'PUT' });
```

</details></td></tr></table>

#### HTTP `interceptor.clear()`

Clears all of the [`HttpRequestHandler`](#httprequesthandler) instances created by this interceptor, including their
registered responses and intercepted requests. After calling this method, the interceptor will no longer intercept any
requests until new mock responses are registered.

This method is useful to reset the interceptor mocks between tests.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
interceptor.clear();
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
await interceptor.clear();
```

</details></td></tr></table>

### `HttpRequestHandler`

HTTP request handlers allow declaring HTTP responses to return for intercepted requests. They also keep track of the
intercepted requests and their responses, which can be used to check if the requests your application has made are
correct.

When multiple handlers match the same method and path, the _last_ created with
[`interceptor.<method>(path)`](#http-interceptormethodpath) will be used.

#### HTTP `handler.method()`

Returns the method that matches a handler.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const handler = interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const handler = await interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td></tr></table>

#### HTTP `handler.path()`

Returns the path that matches a handler. The base URL of the interceptor is not included, but it is used when matching
requests.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const handler = interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const handler = await interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td></tr></table>

#### HTTP `handler.with(restriction)`

Declares a restriction to intercepted request matches. `headers`, `searchParams`, and `body` are supported to limit
which requests will match the handler and receive the mock response. If multiple restrictions are declared, either in a
single object or with multiple calls to `handler.with()`, all of them must be met, essentially creating an AND
condition.

##### Static restrictions

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: creationPayload,
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: creationPayload,
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
match the handler, regardless of having more properties or values. In the example above, requests with more headers than
`content-type: application/json` will still match the handler. The same applies to search params and body restrictions.

If you want to match only requests with the exact values declared, you can use `exact: true`:

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: creationPayload,
    // Only requests with these exact headers and body will match
    exact: true,
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: creationPayload,
    // Only requests with these exact headers and body will match
    exact: true,
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

##### Computed restrictions

A function is also supported to declare restrictions, in case they are dynamic.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

The `request` parameter represents the intercepted request, containing useful properties such as `request.body`,
`request.headers`, `request.pathParams`, and `request.searchParams`, which are typed based on the interceptor schema.
The function should return a boolean: `true` if the request matches the handler and should receive the mock response;
`false` otherwise and the request should bypass the handler.

#### HTTP `handler.respond(declaration)`

Declares a response to return for matched intercepted requests.

When the handler matches a request, it will respond with the given declaration. The response type is statically
validated against the schema of the interceptor.

##### Static responses

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr></table>

##### Computed responses

A function is also supported to declare a response, in case it is dynamic:

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');
  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');
  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td></tr></table>

The `request` parameter represents the intercepted request, containing useful properties such as `request.body`,
`request.headers`, `request.pathParams`, and `request.searchParams`, which are typed based on the interceptor schema.

#### HTTP `handler.bypass()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with
[`handler.respond(declaration)`](#http-handlerresponddeclaration).

This method is useful to skip a handler. It is more gentle than [`handler.clear()`](#http-handlerclear), as it only
removed the response, keeping restrictions and intercepted requests.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

otherListHandler.bypass();
// Now, requests GET /users will match `listHandler` and receive an empty array
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

await otherListHandler.bypass();
// Now, requests GET /users will match `listHandler` and receive an empty array
```

</details></td></tr></table>

#### HTTP `handler.clear()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), restrictions
declared with [`handler.with(restriction)`](#http-handlerwithrestriction), and intercepted requests, making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with `handler.respond()`.

This method is useful to reset handlers to a clean state between tests. It is more aggressive than
[`handler.bypass()`](#http-handlerbypass), as it also clears restrictions and intercepted requests.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

otherListHandler.clear();
// Now, requests GET /users will match `listHandler` and receive an empty array

otherListHandler.requests(); // Now empty
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

await otherListHandler.clear();
// Now, requests GET /users will match `listHandler` and receive an empty array

await otherListHandler.requests(); // Now empty
```

</details></td></tr></table>

#### HTTP `handler.requests()`

Returns the intercepted requests that matched this handler, along with the responses returned to each of them. This is
useful for testing that the correct requests were made by your application.

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const updateHandler = interceptor.put('/users/:id').respond((request) => {
  const newUsername = request.body.username;
  return {
    status: 200,
    body: [{ username: newUsername }],
  };
});

await fetch(`http://localhost:3000/users/${1}`, {
  method: 'PUT',
  body: JSON.stringify({ username: 'new' }),
});

const updateRequests = updateHandler.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].pathParams).toEqual({ id: '1' });
expect(updateRequests[0].body).toEqual({ username: 'new' });
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const updateHandler = await interceptor.put('/users/:id').respond((request) => {
  const newUsername = request.body.username;
  return {
    status: 200,
    body: [{ username: newUsername }],
  };
});

await fetch(`http://localhost:3000/users/${1}`, {
  method: 'PUT',
  body: JSON.stringify({ username: 'new' }),
});

const updateRequests = await updateHandler.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].pathParams).toEqual({ id: '1' });
expect(updateRequests[0].body).toEqual({ username: 'new' });
```

</details></td></tr></table>

The return by `requests` are simplified objects based on the
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) web APIs, containing an already parsed body in
`request.body`, typed headers in `request.headers`, typed path params in `request.pathParams`, and typed search params
in `request.searchParams`.

If you need access to the original `Request` and `Response` objects, you can use the `request.raw` property:

<table><tr><td valign="top"><details open><summary><b>Local</b></summary>

```ts
const listRequests = listHandler.requests();
console.log(listRequests[0].raw); // Request{}
console.log(listRequests[0].response.raw); // Response{}
```

</details></td><td valign="top"><details open><summary><b>Remote</b></summary>

```ts
const listRequests = await listHandler.requests();
console.log(listRequests[0].raw); // Request{}
console.log(listRequests[0].response.raw); // Response{}
```

</details></td></tr></table>

## CLI

### `zimic`

```
zimic <command>

Commands:
  zimic browser  Browser
  zimic server   Interceptor server

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

### `zimic browser`

#### `zimic browser init`

Initialize the browser service worker configuration.

```
zimic browser init <publicDirectory>

Positionals:
  publicDirectory  The path to the public directory of your application.
                                                             [string] [required]
```

This command is necessary to use Zimic in a browser environment. It creates a `mockServiceWorker.js` file in the
provided public directory, which is used to intercept requests and mock responses.

If you are using Zimic mainly in tests, we recommend adding the `mockServiceWorker.js` to your `.gitignore` and adding
this command to a `postinstall` scripts in your `package.json`. This ensures that the latest service worker script is
being used after upgrading Zimic.

### `zimic server`

An interceptor server is a standalone server that can be used to handle requests and return mock responses. It is used
in combination with [remote interceptors](#remote-http-interceptors) to simulate real services.

#### `zimic server start`

Start an interceptor server.

```
zimic server start [-- onReady]

Positionals:
  onReady  A command to run when the server is ready to accept connections.
                                                                        [string]

Options:
      --help                    Show help                              [boolean]
      --version                 Show version number                    [boolean]
  -h, --hostname                The hostname to start the server on.
                                                 [string] [default: "localhost"]
  -p, --port                    The port to start the server on.        [number]
  -e, --ephemeral               Whether the server should stop automatically
                                after the on-ready command finishes. If no
                                on-ready command is provided and ephemeral is
                                true, the server will stop immediately after
                                starting.             [boolean] [default: false]
  -l, --log-unhandled-requests  Whether to log a warning when no interceptors
                                were found for the base URL of a request. If an
                                interceptor was matched, the logging behavior
                                for that base URL is configured in the
                                interceptor itself.                    [boolean]
```

You can use this command to start an independent server:

```bash
zimic server start --port 4000
```

Or as a prefix of another command:

```bash
zimic server start --port 4000 --ephemeral -- npm run test
```

The command after `--` will be executed when the server is ready. The flag `--ephemeral` indicates that the server
should automatically stop after the command finishes.

#### Programmatic usage

The module `zimic/server` exports resources for managing interceptor servers programmatically. Even though we recommend
using the CLI, this module is a valid alternative for more advanced use cases.

```ts
import { createInterceptorServer, runCommand } from 'zimic/server';

const server = createInterceptorServer({ hostname: 'localhost', port: 3000 });
await server.start();

// Run a command when the server is ready
const [command, ...commandArguments] = process.argv.slice(3);
await runCommand(command, commandArguments);

await server.stop();
```

The helper function `runCommand` is useful to run a shell command in server scripts. The
[Next.js App Router](./examples/README.md#nextjs) and the [Playwright](./examples/README.md#playwright) examples use
this function to run the application after the interceptor server is ready and all mocks are set up.

---

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.
