<p align="center">
  <img src="./docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP request mocking
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/zimic">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#table-of-contents">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues/new">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/5">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)
[![NPM Downloads](https://img.shields.io/npm/dm/zimic?style=flat&logo=npm&color=0E69BE&label=Downloads&labelColor=353C43)](https://www.npmjs.com/package/zimic)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)&nbsp;

</div>

---

Zimic is a lightweight, thoroughly tested, TypeScript-first HTTP request mocking library, inspired by
[Zod](https://github.com/colinhacks/zod)'s type inference.

## Features

Zimic provides a flexible and type-safe way to mock HTTP requests.

- :zap: **Statically-typed mocks**. Declare your HTTP endpoints and get full static type inference and validation when
  applying mocks.
- :link: **Network-level intercepts**. Internally, Zimic combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](#zimic-server) to act on real HTTP requests. This means that no parts of your code are stubbed
  or skipped. From you application's point of view, the mocked requests are indistinguishable from the real ones.
- :wrench: **Flexibility**. You can simulate real application workflows by mocking any number of endpoints. This is
  specially useful in testing, making sure that the path your application takes is covered.
- :bulb: **Simplicity**. Zimic was designed from scratch to encourage clarity, simplicity and developer experience in
  your mocks. Check our [getting started guide](#getting-started) and starting mocking!

> [!NOTE]
>
> Zimic has gone a long way in v0, but we're not yet v1!
>
> Reviews and improvements to the public API are possible, so breaking changes may **_exceptionally_** land without a
> major release during v0. Despite of that, we do not expect big mental model shifts. Usually, migrating to a new Zimic
> release requires minimal to no refactoring. During v0, we will follow these guidelines:
>
> - Breaking changes, if any, will be delivered in the next **_minor_** version.
> - Breaking changes, if any, will be documented in the [version release](https://github.com/zimicjs/zimic/releases),
>   along with a migration guide detailing the introduced changes and suggesting steps to migrate.
>
> From v0.8 onwards, we expect Zimic's public API to become more stable. If you'd like to share any feedback, please
> feel free to [open an issue](https://github.com/zimicjs/zimic/issues/new) or
> [create a discussion](https://github.com/zimicjs/zimic/discussions/new/choose)!

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
  - [`HttpFormData`](#httpformdata)
    - [Comparing `HttpFormData`](#comparing-httpformdata)
- [`zimic/interceptor` API reference](#zimicinterceptor-api-reference)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`httpInterceptor.create`](#httpinterceptorcreate)
      - [Creating a local HTTP interceptor](#creating-a-local-http-interceptor)
      - [Creating a remote HTTP interceptor](#creating-a-remote-http-interceptor)
      - [Unhandled requests](#unhandled-requests)
      - [Saving intercepted requests](#saving-intercepted-requests)
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
  - [Intercepted HTTP resources](#intercepted-http-resources)
- [CLI](#cli)
  - [`zimic`](#zimic)
  - [`zimic browser`](#zimic-browser)
    - [`zimic browser init`](#zimic-browser-init)
  - [`zimic server`](#zimic-server)
    - [`zimic server start`](#zimic-server-start)
    - [`zimic server` programmatic usage](#zimic-server-programmatic-usage)
  - [`zimic typegen`](#zimic-typegen)
    - [`zimic typegen openapi`](#zimic-typegen-openapi)
      - [`zimic typegen openapi` comments](#zimic-typegen-openapi-comments)
      - [`zimic typegen openapi` pruning](#zimic-typegen-openapi-pruning)
      - [`zimic typegen openapi` filtering](#zimic-typegen-openapi-filtering)
    - [`zimic typegen` programmatic usage](#zimic-typegen-programmatic-usage)
- [Changelog](#changelog)

## Getting started

### 1. Requirements

- [TypeScript](https://www.typescriptlang.org) >= 4.7

- `strict` enabled in your `tsconfig.json`:
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

> [!TIP]
>
> The type is an individual interceptor setting. It is perfectly possible to have multiple interceptors with different
> types in the same application! However, keep in mind that local interceptors have precedence over remote interceptors.

#### Local HTTP interceptors

When an interceptor is `local`, Zimic uses [MSW](https://github.com/mswjs/msw) to intercept requests _in the same
process_ as your application. This is the simplest way to start mocking requests and does not require any server setup.

When to use `local`:

- **Testing**: If you run your application in the _same_ process as your tests. This is common when using unit and
  integration test runners such as [Jest](https://jestjs.io) and [Vitest](https://vitest.dev).
- **Development**: If you want to mock requests in your development environment without setting up a server. This is be
  useful when you need a backend that is not ready or available.

Our [Vitest](./examples/README.md#vitest), [Jest](./examples/README.md#jest), and
[Next.js Pages Router](./examples/README.md#nextjs) examples use local interceptors.

> [!IMPORTANT]
>
> All mocking operations in local interceptor are **synchronous**. There's no need to `await` them before making
> requests.

#### Remote HTTP interceptors

When an interceptor is `remote`, Zimic uses a dedicated local [interceptor server](#zimic-server) to handle requests.
This opens up more possibilities for mocking, such as handling requests from multiple applications. It is also more
robust because it uses a regular HTTP server and does not depend on local interception algorithms.

When to use `remote`:

- **Testing**: If you _do not_ run your application in the same process as your tests. When using Cypress, Playwright,
  or other end-to-end testing tools, this is generally the case because the test runner and the application run in
  separate processes. This might also happen in more complex setups with unit and integration test runners, such as
  testing a server that is running in another process, terminal, or machine.
- **Development**: If you want your mocked responses to be accessible by other processes in your local network (e.g.
  browser, app, `curl`) . A common scenario is to create a mock server along with a script to apply the mocks. After
  started, the server can be accessed by other applications and return mock responses.

Our [Playwright](./examples/README.md#playwright) and [Next.js App Router](./examples/README.md#nextjs) examples use
remote interceptors.

> [!IMPORTANT]
>
> All mocking operations in remote interceptors are **asynchronous**. Make sure to `await` them before making requests.
>
> Many code snippets in this `README.md` show examples with a local and a remote interceptor. Generally, the remote
> snippets differ only by adding `await` where necessary.
>
> If you are using [`typescript-eslint`](https://typescript-eslint.io), a handy rule is
> [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises). It checks that
> no promises are unhandled, avoiding forgetting to `await` remote interceptor operations.

### 4. Post-install

#### Node.js post-install

No additional configuration is necessary for Node.js. Check out the [usage guide](#usage) and start mocking!

#### Browser post-install

If you plan to use [local interceptors](#local-http-interceptors) and run Zimic in a browser, you must first
[initialize a mock service worker](#zimic-browser-init) in your public directory. After that, check out the
[usage guide](#usage) and start mocking!

## Examples

Visit our [examples](./examples/README.md) to see how to use Zimic with popular frameworks and libraries!

## Usage

### Basic usage

1. To start using Zimic, create your first [HTTP interceptor](#httpinterceptor):

   <table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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

    </details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Remote</b></summary>

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

   In this example, we're [creating an interceptor](#httpinterceptorcreate) for a service supporting `GET` requests to
   `/users`. A successful response contains an array of `User` objects. Learn more about
   [declaring HTTP service schemas](#declaring-http-service-schemas).

2. Then, start the interceptor:

   ```ts
   await interceptor.start();
   ```

   If you are [creating a remote interceptor](#creating-a-remote-http-interceptor), it's necessary to have a running
   [interceptor server](#zimic-server-start) before starting it. The base URL of the remote interceptor should point to
   the server, optionally including a path to differentiate from other interceptors.

3. Now, you can intercept requests and return mock responses!

   <table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

   ```ts
   const listHandler = interceptor.get('/users').respond({
     status: 200,
     body: [{ username: 'diego-aquino' }],
   });

   const response = await fetch('http://localhost:3000/users');
   const users = await response.json();
   console.log(users); // [{ username: 'diego-aquino' }]
   ```

   </details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Remote</b></summary>

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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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
afterEach(() => {
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

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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
afterEach(async () => {
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

When using [remote interceptors](#remote-http-interceptors), a common strategy is to apply your mocks before starting
the application. See [Next.js App Router - Loading mocks](./examples/with-next-js-app/README.md#loading-mocks) and
[Playwright - Loading mocks](./examples/with-playwright/README.md#loading-mocks) for examples.

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
import { HttpHeaders } from 'zimic/http';

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

`HttpHeaders` also provides the utility methods `headers.equals()` and `headers.contains()`, useful in comparisons with
other headers:

<details>
  <summary>Comparing <code>HttpHeaders</code> example:</summary>

```ts
import { HttpSchema, HttpHeaders } from 'zimic/http';

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
type safety when managing search parameters.

<details>
  <summary><code>HttpSearchParams</code> example:</summary>

```ts
import { HttpSearchParams } from 'zimic/http';

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

`HttpSearchParams` also provides the utility methods `searchParams.equals()` and `searchParams.contains()`, useful in
comparisons with other search params:

<details>
  <summary>Comparing <code>HttpSearchParams</code> example:</summary>

```ts
import { HttpSchema, HttpSearchParams } from 'zimic/http';

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

### `HttpFormData`

A superset of the built-in [`FormData`](https://developer.mozilla.org/docs/Web/API/FormData) class, with a
strictly-typed schema. `HttpFormData` is fully compatible with `FormData` and is used by Zimic to provide type safety
when managing form data.

<details>
  <summary><code>HttpFormData</code> example:</summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<{
  files: File[];
  description?: string;
}>();

formData.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData.append('description', 'My file');

const files = formData.getAll('file');
console.log(files); // [File { name: 'file.txt', type: 'text/plain' }]

const description = formData.get('description');
console.log(description); // 'My file'
```

</details>

#### Comparing `HttpFormData`

`HttpFormData` also provides the utility methods `formData.equals()` and `formData.contains()`, useful in comparisons
with other form data:

<details>
  <summary>Comparing <code>HttpFormData</code> example:</summary>

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';

type FormDataSchema = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const formData1 = new HttpFormData<FormDataSchema>();
formData1.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData1.append('description', 'My file');

const formData2 = new HttpFormData<FormDataSchema>();
formData2.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData2.append('description', 'My file');

const formData3 = new HttpFormData<FormDataSchema>();

formData3.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData3.append('description', 'My file');

console.log(formData1.equals(formData2)); // true
console.log(formData1.equals(formData3)); // false

console.log(formData1.contains(formData2)); // true
console.log(formData1.contains(formData3)); // true
console.log(formData3.contains(formData1)); // false
```

</details>

## `zimic/interceptor` API reference

This module provides resources to create HTTP interceptors for both Node.js and browser environments.

### `HttpInterceptor`

HTTP interceptors provide the main API to handle HTTP requests and return mock responses. The methods, paths, status
codes, parameters, and responses are statically-typed based on the service schema.

Each interceptor represents a service and can be used to mock its paths and methods.

#### `httpInterceptor.create`

Creates an HTTP interceptor, the main interface to intercept HTTP requests and return responses. Learn more about
[declaring service schemas](#declaring-http-service-schemas).

##### Creating a local HTTP interceptor

A local interceptor is configured with `type: 'local'`. The `baseURL` represents the URL should be matched by this
interceptor. Any request starting with the `baseURL` will be intercepted if a matching [handler](#httprequesthandler)
exists.

```ts
import { JSONValue } from 'zimic';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

const interceptor = httpInterceptor.create<{
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
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  // The interceptor server is at http://localhost:4000
  // `/my-service` is a path to differentiate from other
  // interceptors using the same server
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
const interceptor = httpInterceptor.create<{
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
> [base URL](#httpinterceptorcreate), [path](#http-interceptormethodpath), [method](#http-interceptormethodpath), and
> [restrictions](#http-handlerwithrestriction) correctly match the request. Additionally, confirm that no errors
> occurred while creating the response.

In a [local interceptor](#local-http-interceptors), unhandled requests are always bypassed, meaning that they pass
through the interceptor and reach the real network. [Remote interceptors](#remote-http-interceptors) in pair with an
[interceptor server](#zimic-server) always reject unhandled requests because they cannot be bypassed.

You can override the default logging behavior per interceptor with `onUnhandledRequest` in `httpInterceptor.create()`.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  onUnhandledRequest: { log: false },
});
```

`onUnhandledRequest` also accepts a function to dynamically choose when to ignore an unhandled request. Calling
`await context.log()` logs the request to the console. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
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
URL, you can use `httpInterceptor.default.onUnhandledRequest`. Keep in mind that defining an `onUnhandledRequest` when
creating an interceptor will take precedence over `httpInterceptor.default.onUnhandledRequest`.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

// Example 1: Ignore all unhandled requests
httpInterceptor.default.onUnhandledRequest({ log: false });

// Example 2: Ignore only unhandled requests to /assets
httpInterceptor.default.onUnhandledRequest((request, context) => {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/assets')) {
    await context.log();
  }
});
```

##### Saving intercepted requests

The option `saveRequests` indicates whether [request handlers](#httprequesthandler) should save their intercepted
requests in memory and make them accessible through [`handler.requests()`](#http-handlerrequests).

This setting is configured per interceptor and is `false` by default. If set to `true`, each handler will keep track of
their intercepted requests in memory.

> [!IMPORTANT]
>
> Saving the intercepted requests will lead to a memory leak if not accompanied by clearing of the interceptor or
> disposal of the handlers (i.e. garbage collection).
>
> If you plan on accessing those requests, such as to assert them in your tests, set `saveRequests` to `true` and make
> sure to regularly clear the interceptor. A common practice is to call [`interceptor.clear()`](#http-interceptorclear)
> after each test.
>
> See [Testing](#testing) for an example of how to manage the lifecycle of interceptors in your tests.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  saveRequests: true,
});
```

> [!TIP]
>
> If you use an interceptor both in tests and as a standalone mock server, consider setting `saveRequests` based on an
> environment variable. This allows you to access the requests in tests, while preventing memory leaks in long-running
> mock servers.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  saveRequests: process.env.NODE_ENV === 'test',
});
```

#### Declaring HTTP service schemas

HTTP service schemas define the structure of the real services being mocked. This includes paths, methods, request and
response bodies, and status codes. Based on the schema, interceptors will provide type validation when applying mocks.

<details>
  <summary>An example of a complete interceptor schema:</summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

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
const interceptor = httpInterceptor.create<{
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
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

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
const interceptor = httpInterceptor.create<ServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP paths

At the root level, each key represents a path or route of the service:

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
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
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

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

const interceptor = httpInterceptor.create<UserPaths & PostPaths>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

##### Declaring HTTP methods

Each path can have one or more methods, (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`). The method
names are case-sensitive.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
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
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserMethods = HttpSchema.Methods<{
  GET: {
    // Method schema
  };
  POST: {
    // Method schema
  };
}>;

const interceptor = httpInterceptor.create<{
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

<details open>
  <summary>
    Declaring a request type with <b>search params</b>:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      request: { searchParams: UserListSearchParams };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a request type with <b>JSON</b> body:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserCreationBody = JSONValue<{
  username: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: UserCreationBody };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

> [!IMPORTANT]
>
> JSON body types cannot be declared using TypeScript interfaces, because they do not have implicit index signatures as
> types do. Part of Zimic's JSON validation relies on index signatures. To workaround this, you can declare JSON bodies
> using `type`. As an extra step to make sure the type is a valid JSON, you can use the utility type `JSONValue`.

> [!TIP]
>
> The utility type `JSONSerialized`, exported from `zimic`, can be handy to infer the serialized type of an object. It
> converts `Date`'s to strings, removes function properties and serializes nested objects and arrays.

```ts
import { JSONSerialized } from 'zimic/http';

class User {
  name: string;
  age: number;
  createdAt: Date;
  method() {
    // ...
  }
}

type SerializedUser = JSONSerialized<User>;
// { name: string, age: number, createdAt: string }
```

<details>
  <summary>
    Declaring a request type with <b>form data</b> body:
  </summary>

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type FileUploadData = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/files': {
    POST: {
      request: { body: HttpFormData<FileUploadData> };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    Declaring a request type with <b>blob</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: Blob };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    Declaring a request type with <b>plain text</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: string };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    Declaring a request type with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

```ts
import { HttpSchema, HttpSearchParams } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: HttpSearchParams<UserListSearchParams> };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

> [!TIP]
>
> You only need to include in the schema the properties you want to use in your mocks. Headers, search params, or body
> fields that are not used do not need to be declared, keeping your type definitions clean and concise.

<details>
  <summary>
    You can also compose requests using the utility type <code>HttpSchema.Request</code>, similarly to
    <a href="#declaring-http-methods">methods</a>:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserCreationBody = JSONValue<{
  username: string;
}>;

type UserCreationRequest = HttpSchema.Request<{
  body: UserCreationBody;
}>;

const interceptor = httpInterceptor.create<{
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

Bodies can be a JSON object, [`HttpFormData`](#httpformdata), [`HttpSearchParams`](#httpsearchparams), `Blob`, or plain
text.

<details open>
  <summary>
    Declaring a response type with <b>JSON</b> body:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

const interceptor = httpInterceptor.create<{
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

> [!IMPORTANT]
>
> Also similarly to [declaring HTTP requests](#declaring-http-requests), JSON body types cannot be declared using
> TypeScript interfaces, because they do not have implicit index signatures as types do. Part of Zimic's JSON validation
> relies on index signatures. To workaround this, you can declare bodies using `type`. As an extra step to make sure the
> type is a valid JSON, you can use the utility type `JSONValue`.

<details>
  <summary>
    Declaring a response type with <b>form data</b> body:
  </summary>

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type FileUploadData = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/files': {
    POST: {
      response: {
        200: { body: HttpFormData<FileUploadData> };
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
  <summary>
    Declaring a response type with <b>blob</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: Blob };
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
  <summary>
    Declaring a response type with <b>plain text</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: string };
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
  <summary>
    Declaring a response type with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

```ts
import { HttpSchema, HttpSearchParams } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: HttpSearchParams<UserListSearchParams> };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

> [!TIP]
>
> Similarly to [declaring HTTP requests](#declaring-http-requests), you only need to include in the schema the
> properties you want to use in your mocks. Headers, search params, or body fields that are not used do not need to be
> declared, keeping your type definitions clean and concise.

<details>
  <summary>
    You can also compose responses using the utility types <code>HttpSchema.ResponseByStatusCode</code> and
    <code>HttpSchema.Response</code>, similarly to <a href="#declaring-http-requests">requests</a>:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

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

const interceptor = httpInterceptor.create<{
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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

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

const listHandler = interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

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
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
interceptor.clear();
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const handler = interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const handler = await interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td></tr></table>

#### HTTP `handler.path()`

Returns the path that matches a handler. The base URL of the interceptor is not included, but it is used when matching
requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const handler = interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const handler = await interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td></tr></table>

#### HTTP `handler.with(restriction)`

Declares a restriction to intercepted requests. `headers`, `searchParams`, and `body` are supported to limit which
requests will match the handler and receive the mock response. If multiple restrictions are declared, either in a single
object or with multiple calls to `handler.with()`, all of them must be met, essentially creating an AND condition.

##### Static restrictions

<details open>
  <summary>
    Declaring restrictions for <b>headers</b>:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .get('/users')
  .with({
    headers: { authorization: `Bearer ${token}` },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    headers: { authorization: `Bearer ${token}` },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpHeaders`](#httpheaders):

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const headers = new HttpHeaders<Partial<UserListHeaders>>();
headers.set('authorization', `Bearer ${token}`);

const creationHandler = interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const headers = new HttpHeaders<Partial<UserListHeaders>>();
headers.set('authorization', `Bearer ${token}`);

const creationHandler = await interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>
</details>

<details open>
  <summary>
    Declaring restrictions for <b>search params</b>:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .get('/users')
  .with({
    searchParams: { username: 'diego-aquino' },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    searchParams: { username: 'diego-aquino' },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpSearchParams`](#httpsearchparams):

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const searchParams = new HttpSearchParams<Partial<UserListSearchParams>>();
searchParams.set('username', 'diego-aquino');

const creationHandler = interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const searchParams = new HttpSearchParams<Partial<UserListSearchParams>>();
searchParams.set('username', 'diego-aquino');

const creationHandler = await interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>
</details>

<details open>
  <summary>
    Declaring restrictions for a <b>JSON</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: { username: 'diego-aquino' },
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: { username: 'diego-aquino' },
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For JSON bodies to be correctly parsed, make sure that the intercepted requests have the header
`content-type: application/json`.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>form data</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<Partial<UserCreationData>>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const creationHandler = interceptor
  .post('/users')
  .with({
    body: formData,
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<Partial<UserCreationData>>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const creationHandler = await interceptor
  .post('/users')
  .with({
    body: formData,
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For form data bodies to be correctly parsed, make sure that the intercepted requests have the header
`content-type: multipart/form-data`.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>blob</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: new Blob(['content'], {
      type: 'application/octet-stream',
    }),
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: new Blob(['content'], {
      type: 'application/octet-stream',
    }),
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For blob bodies to be correctly parsed, make sure that the intercepted requests have the header `content-type`
indicating a binary data, such as `application/octet-stream`, `image/png`, `audio/mp3`, etc.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>plain text</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: 'content',
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: 'content',
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For plain text bodies to be correctly parsed, make sure that the intercepted requests have the header `content-type`
indicating a plain text, such as `text/plain`.

</details>

By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
match the handler, regardless of having more properties or values. In the examples above, requests with more properties
in the headers, search params, or body would still match the restrictions.

If you want to match only requests with the exact values declared, you can use `exact: true`:

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'diego-aquino' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'diego-aquino' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

##### Computed restrictions

A function is also supported to declare restrictions in case they are dynamic. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 201,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 201,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

The function should return a boolean: `true` if the request matches the handler and should receive the mock response;
`false` otherwise.

#### HTTP `handler.respond(declaration)`

Declares a response to return for matched intercepted requests.

When the handler matches a request, it will respond with the given declaration. The response type is statically
validated against the schema of the interceptor.

##### Static responses

<details open>
  <summary>
    Declaring responses with <b>JSON</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>form data</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const listHandler = interceptor.get('/users/:id').respond({
  status: 200,
  body: formData,
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const listHandler = await interceptor.get('/users/:id').respond({
  status: 200,
  body: formData,
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>blob</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: new Blob(['content'], {
    type: 'application/octet-stream',
  }),
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: new Blob(['content'], {
    type: 'application/octet-stream',
  }),
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>plain text</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: 'content',
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: 'content',
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
import { HttpSearchParams } from 'zimic/http';

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  username: 'diego-aquino',
});

const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: searchParams,
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
import { HttpSearchParams } from 'zimic/http';

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  username: 'diego-aquino',
});

const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: searchParams,
});
```

</details></td></tr></table>
</details>

##### Computed responses

A function is also supported to declare a response in case it is dynamic. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

```ts
const listHandler = interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');

  if (!username) {
    return { status: 400 };
  }

  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');

  if (!username) {
    return { status: 400 };
  }

  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td></tr></table>

#### HTTP `handler.bypass()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with
[`handler.respond(declaration)`](#http-handlerresponddeclaration).

This method is useful to skip a handler. It is more gentle than [`handler.clear()`](#http-handlerclear), as it only
removed the response, keeping restrictions and intercepted requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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
useful for testing that the correct requests were made by your application. Learn more about the `request` and
`response` objects at [Intercepted HTTP resources](#intercepted-http-resources).

> [!IMPORTANT]
>
> This method can only be used if `saveRequests` was set to `true` when creating the interceptor. See
> [Saving intercepted requests](#saving-intercepted-requests) for more information.

<table><tr><td width="900px" valign="top"><details open><summary><b>Local</b></summary>

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

const updateRequests = await updateHandler.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].pathParams).toEqual({ id: '1' });
expect(updateRequests[0].body).toEqual({ username: 'new' });
expect(updateRequests[0].response.status).toBe(200);
expect(updateRequests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Remote</b></summary>

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
expect(updateRequests[0].response.status).toBe(200);
expect(updateRequests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td></tr></table>

### Intercepted HTTP resources

The intercepted requests and responses are typed based on their [interceptor schema](#declaring-http-service-schemas).
They are available as simplified objects based on the
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) web APIs. `body` contains the parsed body, while
typed headers, path params and search params are in `headers`, `pathParams`, and `searchParams`, respectively.

The body is automatically parsed based on the header `content-type` of the request or response. The following table
shows how each type is parsed, where `*` indicates any other resource that does not match the previous types:

| `content-type`                      | Parsed to                               |
| ----------------------------------- | --------------------------------------- |
| `application/json`                  | `JSON`                                  |
| `application/xml`                   | `String`                                |
| `application/x-www-form-urlencoded` | [`HttpSearchParams`](#httpsearchparams) |
| `application/*` (others)            | `Blob`                                  |
| `multipart/form-data`               | [`HttpFormData`](#httpformdata)         |
| `multipart/*` (others)              | `Blob`                                  |
| `text/*`                            | `String`                                |
| `image/*`                           | `Blob`                                  |
| `audio/*`                           | `Blob`                                  |
| `font/*`                            | `Blob`                                  |
| `video/*`                           | `Blob`                                  |
| `*/*` (others)                      | `JSON` if possible, otherwise `String`  |

If no `content-type` exists or it is unknown, Zimic tries to parse the body as JSON and falls back to plain text if it
fails.

If you need access to the original `Request` and `Response` objects, you can use the `request.raw` property:

```ts
console.log(request.raw); // Request{}
console.log(request.response.raw); // Response{}
```

## CLI

### `zimic`

```
zimic [command]

Commands:
  zimic browser  Browser
  zimic server   Interceptor server
  zimic typegen  Type generation

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

> [!TIP]
>
> All boolean options in Zimic's CLI can be prefixed with `--no-` to negate them.
>
> For example, all of the options below are equivalent and indicate that comments are **disabled**:
>
> ```bash
> --no-comments
> --comments false
> --comments=false
> ```
>
> On the other hand, all of the options below are also equivalent and indicate that comments are **enabled**:
>
> ```bash
> --comments
> --comments true
> --comments=true
> ```

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
in combination with [remote interceptors](#remote-http-interceptors), which declare which responses the server should
return for a given request. Interceptor servers and remote interceptors communicate with
[remote-procedure calls](https://en.wikipedia.org/wiki/Remote_procedure_call) (RPC) over
[WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).

#### `zimic server start`

Start an interceptor server.

```
zimic server start [-- onReady]

Positionals:
  onReady  A command to run when the server is ready to accept connections.
                                                                        [string]

Options:
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

#### `zimic server` programmatic usage

The module `zimic/server` exports resources for managing interceptor servers programmatically. Even though we recommend
using the CLI, this module is a valid alternative for more advanced use cases.

```ts
import { createInterceptorServer, runCommand } from 'zimic/interceptor/server';

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

### `zimic typegen`

#### `zimic typegen openapi`

Generate types from an OpenAPI schema.

```
zimic typegen openapi <input>

Positionals:
  input  The path to a local OpenAPI schema file or an URL to fetch it. Version
         3.x is supported as YAML or JSON.                   [string] [required]

Options:
  -o, --output        The path to write the generated types to. If not provided,
                      the types will be written to stdout.              [string]
  -s, --service-name  The name of the service to use in the generated types.
                                                             [string] [required]
  -c, --comments      Whether to include comments in the generated types.
                                                       [boolean] [default: true]
  -p, --prune         Whether to remove unused operations and components from
                      the generated types. This is useful for reducing the size
                      of the output file.              [boolean] [default: true]
  -f, --filter        One or more expressions to filter the types to generate.
                      Filters must follow the format `<method> <path>`, where
                      `<method>` is an HTTP method or `*`, and `<path>` is a
                      literal path or a glob. Filters are case-sensitive
                      regarding paths. For example, `GET /users`, `* /users`,
                      `GET /users/*`, and `GET /users/**/*` are valid filters.
                      Negative filters can be created by prefixing the
                      expression with `!`. For example, `!GET /users` will
                      exclude paths matching `GET /users`. If more than one
                      positive filter is provided, they will be combined with
                      OR, while negative filters will be combined with AND.
                                                                         [array]
  -F, --filter-file   A path to a file containing filter expressions. One
                      expression is expected per line and the format is the same
                      as used in a `--filter` option. Comments are prefixed with
                      `#`. A filter file can be used alongside additional
                      `--filter` expressions.                           [string]
```

You can use this command to generate types from a local OpenAPI file:

```bash
zimic typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService
```

Or an URL to fetch it:

```bash
zimic typegen openapi https://example.com/api/openapi.yaml \
  --output ./schema.ts \
  --service-name MyService
```

Then, you can use the types in your interceptors:

```ts
import { httpInterceptor } from 'zimic/interceptor/http';
import { MyServiceSchema } from './schema';

const interceptor = httpInterceptor.create<MyServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

Our [typegen example](./examples/with-typegen) demonstrates how to use `zimic typegen openapi` to generate types and use
them in your application and interceptors.

##### `zimic typegen openapi` comments

By default, descriptions in the OpenAPI schema are included as comments in the generated types. You can omit them using
`--no-comments` or `--comments false`.

```bash
zimic typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --no-comments
```

##### `zimic typegen openapi` pruning

By default, pruning is enabled, meaning that unused types are not generated. If you want all types declared in the
schema to be generated, you can use `--no-prune` or `--prune false`.

```bash
zimic typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --no-prune
```

##### `zimic typegen openapi` filtering

You can also filter a subset of paths to generate types for. Combined with [pruning](#zimic-typegen-openapi-pruning),
this is useful to reduce the size of the output file and only generate the types you need.

```bash
zimic typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --filter 'GET /users**'
```

When many filters are used, a filter file can be provided, where each line represents a filter expression and comments
are marked with `#`:

`filters.txt`

```
# Include any endpoint starting with /users and having any HTTP method
* /users**

# Include any sub-endpoints of /posts with method GET.
GET /posts/**/*

# Include the endpoints /workspaces with methods GET, POST, or PUT.
GET,POST,PUT /workspaces

# Exclude endpoints to get user notifications
!GET /users/*/notifications/**/*
```

Then, you can use the filter file in the command:

```bash
zimic typegen openapi ./schema.yaml \
  --output ./schema.ts \
  --service-name MyService \
  --filter-file ./filters.txt
```

#### `zimic typegen` programmatic usage

The module `zimic/typegen` exports resources for generating types programmatically. We recommend using the CLI, but this
module is a valid alternative for more advanced use cases.

```ts
import { typegen } from 'zimic/typegen';

await typegen.generateFromOpenAPI({
  input: './schema.yaml',
  output: './schema.ts',
  serviceName: 'MyService',
  filters: ['* /users**'],
  includeComments: true,
  prune: true,
});
```

The parameters of `typegen.generateFromOpenAPI` are the same as the CLI options for the `zimic typegen openapi` command.

---

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.
