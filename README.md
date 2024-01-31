<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP request mocking.
</p>

> This project is under active development! Check our [roadmap to v1](https://github.com/users/diego-aquino/projects/5/views/6).
> Contributors and suggestions are welcome!

Zimic is a lightweight, TypeScript-first HTTP request mocking library, inspired by [Zod](https://github.com/colinhacks/zod)'s type-inference and using [msw](https://github.com/mswjs/msw) under the hood.

## Features

- **Typed mocks**: declare the HTTP endpoints and get full type-inference and type-validation when applying mocks. Having a single place to declare routes, parameters and responses means an easier time keeping your mocks in sync with the real services!
- **Network-level intercepts**: internally, Zimic uses [msw](https://github.com/mswjs/msw), which intercepts HTTP requests right _before_ they leave your app. This means that no parts of your code are stubbed or skipped and the mocked requests are indistinguishable from the real ones. If you're mocking requests on a browser, you can even inspect the requests and responses on your devtools!
- **Flexibility**: you can simulate real application workflows by mocking all endpoints used. This is specially useful in testing, making sure the real path your application is covered and allowing checks about how many requests were made and with which parameters.
- **Simplicity**: no complex configuration files or heavy dependencies. Check our [Getting started](#getting-started) guide and starting mocking!
- **Compatibility**: browser and Node.js support!

---

## Table of contents

- [Features](#features)
- [Table of contents](#table-of-contents)
- [Getting started](#getting-started)
  - [1. Requirements](#1-requirements)
  - [2. Install from `npm`](#2-install-from-npm)
  - [3. Post-install](#3-post-install)
    - [Node.js post-install](#nodejs-post-install)
    - [Browser post-install](#browser-post-install)
- [Usage](#usage)
  - [Basic usage](#basic-usage)
  - [Testing](#testing)
- [Changelog](#changelog)
- [`zimic/interceptor` API](#zimicinterceptor-api)
  - [`createNodeHttpInterceptor`](#createnodehttpinterceptor)
  - [`createBrowserHttpInterceptor`](#createbrowserhttpinterceptor)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`interceptor.start()`](#interceptorstart)
    - [`interceptor.stop()`](#interceptorstop)
    - [`interceptor.baseURL()`](#interceptorbaseurl)
    - [`interceptor.isRunning()`](#interceptorisrunning)
    - [`interceptor.<method>(path)`](#interceptormethodpath)
    - [`interceptor.clear()`](#interceptorclear)
  - [`HttpRequestTracker`](#httprequesttracker)
    - [`tracker.respond(declaration)`](#trackerresponddeclaration)
    - [`tracker.bypass()`](#trackerbypass)
    - [`tracker.requests()`](#trackerrequests)
- [CLI](#cli)
  - [`zimic --version`](#zimic---version)
  - [`zimic --help`](#zimic---help)
  - [`zimic browser init <publicDirectory>`](#zimic-browser-init-publicdirectory)
- [Development](#development)

## Getting started

### 1. Requirements

- TypeScript >=4.7

- `strict` mode enabled in your `tsconfig.json`:
  ```json
  // tsconfig.json
  {
    // ...
    "compilerOptions": {
      // ...
      "strict": true
    }
  }
  ```

### 2. Install from `npm`

```bash
npm install zimic --save-dev # npm
yarn add zimic --dev         # yarn
pnpm add zimic --save-dev    # pnpm
bun add zimic --dev          # bun
```

Canary versions are released under the `canary` tag:

```bash
npm install zimic@canary --save-dev # npm
yarn add zimic@canary --dev         # yarn
pnpm add zimic@canary --save-dev    # pnpm
bun add zimic@canary --dev          # bun
```

### 3. Post-install

#### Node.js post-install

No additional configuration is necessary for Node.js. Check out the [usage](#usage) guide and start mocking!

#### Browser post-install

To use Zimic on a browser, you should first initialize the mock service worker in your public directory:

```bash
npx zimic browser init <publicDirectory>
```

This will create a `mockServiceWorker.js` file in the provided public directory, which is necessary to intercept requests and mock responses.

## Usage

### Basic usage

@TODO

Declare the endpoint schema of a service and create an HTTP interceptor:

```ts

```

### Testing

Interceptors must be started to intercept requests. We recommend managing the lifecycle of interceptors with `beforeAll` and `afterAll` hooks in your test setup file, or equivalent depending on your testing framework. An example with Jest/Vitest-like syntax:

```ts
// tests/setup.ts
beforeAll(async () => {
  await interceptor.start(); // starts intercepting requests
});

beforeEach(async () => {
  await interceptor.clear(); // clears all applied mocks to make sure no tests affect each other
});

afterAll(() => {
  interceptor.stop(); // stops intercepting requests
});
```

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/diego-aquino/zimic/releases) page.

---

## `zimic/interceptor` API

This module provides a set of utilities to create HTTP interceptors for both Node.js and browser environments.

All APIs are typed using TypeScript and documented using JSDoc comments, so you can view detailed descriptions directly in your IDE!

### `createNodeHttpInterceptor`

A factory function that creates an `HttpInterceptor` instance for a Node.js environment.

```ts
import { createNodeHttpInterceptor } from 'zimic/interceptor/node'; // <-- import from `node`

const interceptor = createNodeHttpInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
});
```

### `createBrowserHttpInterceptor`

A factory function that creates an `HttpInterceptor` instance for a browser environment.

```ts
import { createBrowserHttpInterceptor } from 'zimic/interceptor/browser'; // <-- import from `browser`

const interceptor = createBrowserHttpInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
});
```

### `HttpInterceptor`

HTTP interceptors provide the main API to apply mocks to HTTP requests.

#### `interceptor.start()`

Before using an interceptor, it must be started:

```ts
await interceptor.start();
```

#### `interceptor.stop()`

After use, the interceptor must be stopped, after which no more requests will be intercepted:

```ts
interceptor.stop();
```

#### `interceptor.baseURL()`

Returns the base URL of the interceptor.

```ts
const interceptor = createNodeHttpInterceptor<{}>({
  baseURL: 'http://localhost:3000',
});

const baseURL = interceptor.baseURL();
console.log(baseURL); // http://localhost:3000
```

#### `interceptor.isRunning()`

Returns a boolean indicating whether the interceptor is currently intercepting requests.

```ts
const interceptor = createNodeHttpInterceptor<{}>({
  baseURL: 'http://localhost:3000',
});
console.log(interceptor.isRunning()); // false

await interceptor.start();
console.log(interceptor.isRunning()); // true

interceptor.stop();
console.log(interceptor.isRunning()); // false
```

#### `interceptor.<method>(path)`

Creates an `HttpRequestTracker` instance for the given method and path. The path must be declared in the interceptor schema (generic passed to `createNodeHttpInterceptor` or `createBrowserHttpInterceptor`).

The supported methods are: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`.

```ts
const interceptor = createNodeHttpInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
});

const listTracker = interceptor.get('/users')

listTracker.respond({
  status: 200
  body: [{ id: 1, name: 'Diego' }],
});
```

Paths with dynamic route parameters, such as `/users/:id`, are supported, but it's necessary to explicitly declare the original path to get type-inference and type-validation.

```ts
const interceptor = createNodeHttpInterceptor<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
});

interceptor.get('/users/:id'); // matches any id
interceptor.get<'/users/:id'>(`/users/${1}`); // only matches id 1 (see the explicit original path as a generic)
```

#### `interceptor.clear()`

Clears all the applied mocks from the interceptor.

```ts
interceptor.clear();
```

After this, all current trackers are marked as unusable. However, if the interceptor is still running, new mocks can be applied creating new trackers with [`interceptor.<method>(path)`](#interceptormethodpath).

Note: clearing an intercetor does not stop it. If you want to stop intercepting requests, use [`interceptor.stop()`](#interceptorstop).

### `HttpRequestTracker`

HTTP request trackers allow specifying specific responses for requests. When multiple trackers match the same method and route, the _last_ created with [`interceptor.<method>(path)`](#interceptormethodpath) will be used.

#### `tracker.respond(declaration)`

Declares a response for a request tracker. When the tracker matches a request, it will respond with the given declaration. The response type is validated against the schema declared in the interceptor.

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ id: 1, name: 'Diego' }],
});
```

A function is also supported, in case the response is dynamic:

```ts
const listTracker = interceptor.get('/users').respond((request) => {
  const { name } = request.body;
  return {
    status: 200,
    body: [{ id: 1, name }],
  };
});
```

#### `tracker.bypass()`

Bypasses the request tracker, meaning that it won't match any more requests. This is useful when you want to skip a tracker in favor of one created before.

```ts
const listTracker1 = interceptor.get('/users').respond({
  status: 200,
  body: [{ id: 1, name: 'Diego' }],
});
const listTracker2 = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

listTracker2.bypass();

// GET requests to /users will only match listTracker1
```

#### `tracker.requests()`

Returns an array of all requests that matched the tracker, were intercepted and responded with the mock declaration.

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ id: 1, name: 'Diego' }],
});

await fetch('http://localhost:3000/users');

const listRequests = listTracker.requests();
console.log(listRequests.length); // 1
console.log(listRequests[0].body); // null
console.log(listRequests[0].response.body); // [{ id: 1, name: 'Diego' }]
```

The return by `requests` contains simplified objects based on the [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) web APIs, with only the necessary properties for inspection and a body already parsed. If you need access to the original `Request` and `Response` objects, you can use the `.raw` property:

```ts
const listRequests = listTracker.requests();
console.log(listRequests[0].raw); // Request{}
console.log(listRequests[0].response.raw); // Response{}
```

## CLI

### `zimic --version`

Displays the current version of Zimic.

### `zimic --help`

Displays the available commands and options.

### `zimic browser init <publicDirectory>`

Initializes the mock service worker in a public directory. If you are using Zimic mainly in tests, we recommend adding the `mockServiceWorker.js` to your `.gitignore` and adding a `postinstall` scripts to your `package.json`. This ensures that the latest service worker script is being used after upgrading Zimic.

---

## Development

Interested in contributing to Zimic? View our [contributing guide](./CONTRIBUTING.md).
