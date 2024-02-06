<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP request mocking.
</p>

> This project is under active development! Check our [roadmap to v1](https://github.com/users/diego-aquino/projects/5/views/6).
> Contributors and suggestions are welcome!

Zimic is a lightweight, TypeScript-first HTTP request mocking library, inspired by [Zod](https://github.com/colinhacks/zod)'s type-inference and using [MSW](https://github.com/mswjs/msw) under the hood.

## Features

- **Typed mocks**: declare the HTTP endpoints and get full type-inference and type-validation when applying mocks. Having a single place to declare routes, parameters and responses means an easier time keeping your mocks in sync with the real services!
- **Network-level intercepts**: internally, Zimic uses [MSW](https://github.com/mswjs/msw), which intercepts HTTP requests right _before_ they leave your app. This means that no parts of your code are stubbed or skipped and the mocked requests are indistinguishable from the real ones. If you're mocking requests on a browser, you can even inspect the requests and responses on your devtools!
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
  - [Testing](#testing)
- [Changelog](#changelog)
- [`zimic/interceptor` API](#zimicinterceptor-api)
  - [`HttpInterceptorWorker`](#httpinterceptorworker)
    - [`createHttpInterceptorWorker`](#createhttpinterceptorworker)
    - [`worker.platform()`](#workerplatform)
    - [`worker.start()`](#workerstart)
    - [`worker.stop()`](#workerstop)
    - [`worker.isRunning()`](#workerisrunning)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`createHttpInterceptor`](#createhttpinterceptor)
      - [`HttpInterceptor` schema](#httpinterceptor-schema)
    - [`interceptor.baseURL()`](#interceptorbaseurl)
    - [`interceptor.<method>(path)`](#interceptormethodpath)
    - [`interceptor.clear()`](#interceptorclear)
  - [`HttpRequestTracker`](#httprequesttracker)
    - [`tracker.method()`](#trackermethod)
    - [`tracker.path()`](#trackerpath)
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
  ```jsonc
  // tsconfig.json
  {
    // ...
    "compilerOptions": {
      // ...
      "strict": true,
    },
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

@TODO

### Testing

Interceptor workers must be started so that their interceptors handle requests. We recommend managing the lifecycle of interceptors with `beforeAll` and `afterAll` hooks in your test setup file, or equivalent depending on your testing framework. An example with Jest/Vitest-like syntax:

```ts
// tests/setup.ts
import { createHttpInterceptorWorker, createHttpInterceptor } from 'zimic/interceptor';

// create a worker
const worker = createHttpInterceptorWorker({
  platform: 'node',
});

// declare your interceptors
const userInterceptor = createHttpInterceptor<{
  // ...
}>({
  worker,
  baseURL: 'http://localhost:3000',
});

const logInterceptor = createHttpInterceptor<{
  // ...
}>({
  worker,
  baseURL: 'http://localhost:3001',
});

beforeAll(async () => {
  // start intercepting requests
  await worker.start();
});

beforeEach(async () => {
  // clear all interceptors to make sure no tests affect each other
  userInterceptor.clear();
  logInterceptor.clear();
});

afterAll(async () => {
  // stop intercepting requests
  await worker.stop();
});
```

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/diego-aquino/zimic/releases) page.

---

## `zimic/interceptor` API

This module provides a set of utilities to create HTTP interceptors for both Node.js and browser environments.

All APIs are typed using TypeScript and documented using JSDoc comments, so you can view detailed descriptions directly in your IDE!

### `HttpInterceptorWorker`

Worker responsible for intercepting HTTP requests and returning mock responses, compatible with browser and Node.js. All interceptors in a project can share the same worker. To start intercepting requests, the worker must be started.

#### `createHttpInterceptorWorker`

Creates a new HTTP interceptor worker instance. A platform is required to specify the environment where the worker will be running.

- Node.js:

  ```ts
  const worker = createHttpInterceptorWorker({
    platform: 'node',
  });
  ```

- Browser:

  ```ts
  const worker = createHttpInterceptorWorker({
    platform: 'browser',
  });
  ```

#### `worker.platform()`

Returns the platform used by the worker (`browser` or `node`).

```ts
const platform = worker.platform();
```

#### `worker.start()`

Starts the worker, allowing it to intercept HTTP requests.

```ts
await worker.start();
```

When targeting a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal before starting a worker. This initializes the mock service worker in your public directory. Learn more at [`zimic browser init <publicDirectory`](#workerstart).

#### `worker.stop()`

Stops the worker, preventing it from intercepting HTTP requests.

```ts
await worker.stop();
```

#### `worker.isRunning()`

Returns whether the worker is currently running and able to intercept HTTP requests.

```ts
const isRunning = worker.isRunning();
```

### `HttpInterceptor`

HTTP interceptors provide the main API to apply mocks to HTTP requests.

#### `createHttpInterceptor`

Creates a new HTTP interceptor instance.

The interceptor schema is used to declare the structure of the real service being mocked. This includes routes, methods, request and response bodies, and status codes. Based on the schema, the interceptor will provide type-inference and type-validation when applying mocks.

```ts
import { createHttpInterceptor } from 'zimic/interceptor';

const worker = createHttpInterceptorWorker({
  platform: 'node',
});

const interceptor = createHttpInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema

@TODO

#### `interceptor.baseURL()`

Returns the base URL of the interceptor.

```ts
const baseURL = interceptor.baseURL();
```

#### `interceptor.<method>(path)`

Creates an [`HttpRequestTracker`](#httprequesttracker) instance for the given method and path. The path and method must be declared in the interceptor schema.

The supported methods are: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`.

```ts
const interceptor = createHttpInterceptor<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});

// any GET requests to http://localhost:3000/users will be intercepted and returned with the given response
const listTracker = interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

Paths with dynamic route parameters, such as `/users/:id`, are supported, but you need to specify the original path as a type parameter to get type-inference and type-validation.

```ts
const interceptor = createHttpInterceptor<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});

interceptor.get('/users/:id'); // matches any id
interceptor.get<'/users/:id'>(`/users/${1}`); // only matches id 1 (see the original path as a type parameter)
```

#### `interceptor.clear()`

Clears all of the [HttpRequestTracker](#httprequesttracker) instances created by this interceptor. After calling this method, the interceptor will no longer intercept any requests until new mock responses are registered.

This method is useful to reset the interceptor mocks between tests.

```ts
interceptor.clear();
```

### `HttpRequestTracker`

Tracker for intercepted HTTP requests, supporting response declarations to return for matched intercepted requests.

When multiple trackers match the same method and route, the _last_ created with [`interceptor.<method>(path)`](#interceptormethodpath) will be used.

#### `tracker.method()`

Returns the method that matches this tracker.

```ts
const method = tracker.method();
```

#### `tracker.path()`

Returns the path that matches this tracker. The base URL of the interceptor is not included, but it is used when checking for intercepted request matches.

```ts
const path = tracker.path();
```

#### `tracker.respond(declaration)`

Declares a response to return for matched intercepted requests.

When the tracker matches a request, it will respond with the given declaration. The response type is statically validated against the schema of the interceptor.

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

A function is also supported, in case the response is dynamic:

```ts
const listTracker = interceptor.get('/users').respond((request) => {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  return {
    status: 200,
    body: [{ username }],
  };
});
```

#### `tracker.bypass()`

Clears any declared response and makes the tracker stop matching intercepted requests. The next tracker, created before this one, that matches the same method and path will be used if present. If not, the requests of the method and path will not be intercepted.

```ts
const listTracker1 = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const listTracker2 = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

listTracker2.bypass();

// GET requests to /users will match listTracker1 and return an empty array
```

#### `tracker.requests()`

Returns the intercepted requests that matched this tracker, along with the responses returned to each of them. This is useful for testing that the correct requests were made by your application.

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

await fetch('http://localhost:3000/users');

const listRequests = listTracker.requests();
console.log(listRequests.length); // 1
console.log(listRequests[0].body); // null
console.log(listRequests[0].response.body); // [{ username: 'diego-aquino' }]
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

Initializes the mock service worker in a public directory.

This command is necessary when using Zimic in a browser environment. It creates a `mockServiceWorker.js` file in the provided public directory, which is used to intercept requests and mock responses.

If you are using Zimic mainly in tests, we recommend adding the `mockServiceWorker.js` to your `.gitignore` and adding this command to a `postinstall` scripts in your `package.json`. This ensures that the latest service worker script is being used after upgrading Zimic.

---

## Development

Interested in contributing to Zimic? View our [contributing guide](./CONTRIBUTING.md).
