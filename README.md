<h1 align="center">
  Zimic
</h1>

<p align="center">
  TypeScript-first HTTP request mocking.
</p>

> This project is under active development! Check our [roadmap to v1](https://github.com/users/diego-aquino/projects/5/views/6).
> Contributors and suggestions are welcome!

Zimic is a lightweight, TypeScript-first HTTP request mocking library, inspired by [Zod](https://github.com/colinhacks/zod)'s type inference and using [MSW](https://github.com/mswjs/msw) under the hood.

## Features

Zimic provides a simple, flexible and type-safe way to mock HTTP requests.

- **Statically-typed mocks**: declare your HTTP endpoints and get full type inference and validation when applying mocks.
- **Network-level intercepts**: internally, Zimic uses [MSW](https://github.com/mswjs/msw), which intercepts HTTP requests right _before_ they leave your app. This means that no parts of your code are stubbed or skipped. From you application's point of view, the mocked requests are indistinguishable from the real ones. If you're mocking on a browser, you can even inspect the requests and responses on your devtools!
- **Flexibility**: you can simulate real application workflows by mocking each endpoints used. This is specially useful in testing, making sure the real path your application is covered and allowing checks about how many requests were made and with which parameters.
- **Simplicity and opinion**: having no complex configuration or heavy dependencies, Zimic was designed from scratch to encourage clarity, simplicity and standardization. Check our [Getting started](#getting-started) guide and starting mocking!

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
  - [`HttpInterceptorWorker`](#httpinterceptorworker)
    - [`createHttpInterceptorWorker`](#createhttpinterceptorworker)
    - [`worker.platform()`](#workerplatform)
    - [`worker.start()`](#workerstart)
    - [`worker.stop()`](#workerstop)
    - [`worker.isRunning()`](#workerisrunning)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`createHttpInterceptor`](#createhttpinterceptor)
    - [`HttpInterceptor` schema](#httpinterceptor-schema)
      - [`HttpInterceptor` schema paths](#httpinterceptor-schema-paths)
      - [`HttpInterceptor` schema path composition](#httpinterceptor-schema-path-composition)
      - [`HttpInterceptor` schema methods](#httpinterceptor-schema-methods)
      - [`HttpInterceptor` schema method composition](#httpinterceptor-schema-method-composition)
      - [`HttpInterceptor` schema requests](#httpinterceptor-schema-requests)
      - [`HttpInterceptor` schema request composition](#httpinterceptor-schema-request-composition)
      - [`HttpInterceptor` schema responses](#httpinterceptor-schema-responses)
      - [`HttpInterceptor` schema response composition](#httpinterceptor-schema-response-composition)
      - [`HttpInterceptor` schema (example)](#httpinterceptor-schema-example)
      - [`HttpInterceptor` schema composition (example)](#httpinterceptor-schema-composition-example)
    - [`interceptor.baseURL()`](#interceptorbaseurl)
    - [`interceptor.<method>(path)`](#interceptormethodpath)
      - [Dynamic path parameters](#dynamic-path-parameters)
    - [`interceptor.clear()`](#interceptorclear)
  - [`HttpRequestTracker`](#httprequesttracker)
    - [`tracker.method()`](#trackermethod)
    - [`tracker.path()`](#trackerpath)
    - [`tracker.respond(declaration)`](#trackerresponddeclaration)
      - [Static responses](#static-responses)
      - [Computed responses](#computed-responses)
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

### Basic usage

To start using Zimic, create a [worker](#httpinterceptorworker) targeting your platform.

```ts
const worker = createHttpInterceptorWorker({
  platform: 'node', // or 'browser'
});
```

Then, create your first [interceptor](#httpinterceptor):

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
```

In this example, we're creating an interceptor for a service with a single path, `/users`, that supports a `GET` method. The response for a successful request is an array of `User` objects. Learn more about how to declare interceptor schemas at [`HttpInterceptor` schema](#httpinterceptor-schema).

Finally, start the worker to intercept requests:

```ts
await worker.start();
```

Now, you can start intercepting requests and returning mock responses!

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

const response = await fetch('http://localhost:3000/users');
const users = await response.json();
console.log(users); // [{ username: 'diego-aquino' }]
```

More examples are available at [`zimic/interceptor` API](#zimicinterceptor-api).

### Testing

We recommend managing the lifecycle of your workers and interceptors using `beforeAll` and `afterAll` hooks in your test setup file. An example with Jest/Vitest-like syntax:

```ts
// tests/setup.ts
import { createHttpInterceptorWorker, createHttpInterceptor } from 'zimic/interceptor';

// create a worker
const worker = createHttpInterceptorWorker({
  platform: 'node',
});

const userInterceptor = createHttpInterceptor<{
  // declare your schema
}>({
  worker,
  baseURL: 'http://localhost:3000',
});

const logInterceptor = createHttpInterceptor<{
  // declare your schema
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

Workers are used by [HttpInterceptor](#httpinterceptor)'s to intercept HTTP requests and return mock responses. To start intercepting requests, the worker must be started.

In a project, all interceptors can share the same worker.

#### `createHttpInterceptorWorker`

Creates an HTTP interceptor worker. A platform is required to specify the environment where the worker will be running:

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

Starts the worker, allowing it to be used by interceptors.

```ts
await worker.start();
```

When targeting a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal before starting the worker. This initializes the mock service worker in your public directory. Learn more at [`zimic browser init <publicDirectory`](#workerstart).

#### `worker.stop()`

Stops the worker, preventing it from being used by interceptors.

```ts
await worker.stop();
```

#### `worker.isRunning()`

Returns whether the worker is currently running and ready to use.

```ts
const isRunning = worker.isRunning();
```

### `HttpInterceptor`

HTTP interceptors provide the main API to handle matched HTTP requests and return mock responses. The methods, paths, status codes, parameters, and responses are statically-typed based on the provided service schema. To intercept HTTP requests, an interceptor needs a running [HttpInterceptorWorker](#httpinterceptorworker).

Each interceptor represents a service and can be used to mock its paths and methods.

#### `createHttpInterceptor`

Creates an HTTP interceptor.

The interceptor schema defines the structure of the real service being mocked. This includes paths, methods, request and response bodies, and status codes. Based on the schema, the interceptor will provide type validation when applying mocks.

```ts
import { createHttpInterceptorWorker, createHttpInterceptor } from 'zimic/interceptor';

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

#### `HttpInterceptor` schema

HTTP interceptor schemas are defined using types or interfaces.

##### `HttpInterceptor` schema paths

At the root level, each key represents a path or path:

```ts
const interceptor = createHttpInterceptor<{
  '/users': {
    // path schema
  };
  '/users/:id': {
    // path schema
  };
  '/posts': {
    // path schema
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema path composition

As an alternative, you can also compose root level paths using the utility type `HttpInterceptorSchema.Root`:

```ts
type UserPaths = HttpInterceptorSchema.Root<{
  '/users': {
    // path schema
  };
  '/users/:id': {
    // path schema
  };
}>;

type PostPaths = HttpInterceptorSchema.Root<{
  '/posts': {
    // path schema
  };
}>;

const interceptor = createHttpInterceptor<UserPaths & PostPaths>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema methods

Each path can have one or more methods, (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`). The method names are case-sensitive.

```ts
const interceptor = createHttpInterceptor<{
  '/users': {
    GET: {
      // method schema
    };
    POST: {
      // method schema
    };
  };
  // other paths
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema method composition

Similarly to [paths](#httpinterceptor-schema-paths), you can also compose methods using the utility type `HttpInterceptorSchema.Method`:

```ts
type UserMethods = HttpInterceptorSchema.Method<{
  GET: {
    // method schema
  };
  POST: {
    // method schema
  };
}>;

const interceptor = createHttpInterceptor<{
  '/users': UserMethods;
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema requests

Each method can have a `request`, which defines the schema of the accepted requests. Currently, only the `body` property is supported.

```ts
const interceptor = createHttpInterceptor<{
  '/users': {
    POST: {
      request: {
        body: {
          username: string;
        };
      };
      // ...
    };
    // other methods
  };
  // other paths
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema request composition

You can also compose requests using the utility type `HttpInterceptorSchema.Request`, similarly to [methods](#httpinterceptor-schema-methods):

```ts
type UserCreationRequest = HttpInterceptorSchema.Request<{
  body: {
    username: string;
  };
}>;

const interceptor = createHttpInterceptor<{
  '/users': {
    POST: {
      request: UserCreationRequest;
    };
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema responses

Each method can also have a `response`, which defines the schema of the returned responses. The status codes are used as keys. Currently, only the `body` property is supported.

```ts
const interceptor = createHttpInterceptor<{
  '/users/:id': {
    GET: {
      // ...
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
    // other methods
  };
  // other paths
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema response composition

You can also compose responses using the utility types `HttpInterceptorSchema.ResponseByStatusCode` and `HttpInterceptorSchema.Response`, similarly to [requests](#httpinterceptor-schema-requests):

```ts
type SuccessUserGetResponse = HttpInterceptorSchema.Response<{
  body: User;
}>;

type NotFoundUserGetResponse = HttpInterceptorSchema.Response<{
  body: NotFoundError;
}>;

type UserGetResponses = HttpInterceptorSchema.ResponseByStatusCode<{
  200: SuccessUserGetResponse;
  404: NotFoundUserGetResponse;
}>;

const interceptor = createHttpInterceptor<{
  '/users': {
    GET: {
      // ...
      response: UserGetResponses;
    };
    // other methods
  };
  // other paths
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema (example)

Combining all of these, you can define a complete schema for your services:

```ts
const interceptor = createHttpInterceptor<{
  '/users': {
    POST: {
      request: {
        body: {
          username: string;
        };
      };
      response: {
        201: { body: User };
      };
    };
    GET: {
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

  '/posts': {
    GET: {
      response: {
        200: { body: Post[] };
      };
    };
  };
}>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

##### `HttpInterceptor` schema composition (example)

Alternatively, you can compose the schema using utility types:

```ts
type UserPaths = HttpInterceptorSchema.Root<{
  '/users': {
    POST: {
      request: {
        body: {
          username: string;
        };
      };
      response: {
        201: { body: User };
      };
    };

    GET: {
      response: {
        200: { body: User[] };
        404: { body: NotFoundError };
      };
    };
  };
}>;

type UserByIdPaths = HttpInterceptorSchema.Root<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
  };
}>;

type PostPaths = HttpInterceptorSchema.Root<{
  '/posts': {
    GET: {
      response: {
        200: { body: Post[] };
      };
    };
  };
}>;

const interceptor = createHttpInterceptor<UserPaths & UserByIdPaths & PostPaths>({
  worker,
  baseURL: 'http://localhost:3000',
});
```

#### `interceptor.baseURL()`

Returns the base URL of the interceptor.

```ts
const baseURL = interceptor.baseURL();
```

#### `interceptor.<method>(path)`

Creates an [`HttpRequestTracker`](#httprequesttracker) for the given method and path. The path and method must be declared in the interceptor schema.

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

// intercept any GET requests to http://localhost:3000/users and return this response
const listTracker = interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

##### Dynamic path parameters

Paths with dynamic path parameters, such as `/users/:id`, are supported, but you need to specify the original path as a type parameter to get type validation.

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
interceptor.get<'/users/:id'>(`/users/${1}`); // only matches id 1 (notice the original path as a type parameter)
```

#### `interceptor.clear()`

Clears all of the [HttpRequestTracker](#httprequesttracker) instances created by this interceptor, including their registered responses and saved intercepted requests. After calling this method, the interceptor will no longer intercept any requests until new mock responses are registered.

This method is useful to reset the interceptor mocks between tests.

```ts
interceptor.clear();
```

### `HttpRequestTracker`

HTTP request trackers allow declaring responses to return for matched intercepted requests. They also keep track of the intercepted requests and their responses, allowing checks about how many requests your application made and with which parameters.

When multiple trackers match the same method and path, the _last_ created with [`interceptor.<method>(path)`](#interceptormethodpath) will be used.

#### `tracker.method()`

Returns the method that matches this tracker.

```ts
const tracker = interceptor.post('/users');
const method = tracker.method();
console.log(method); // 'POST'
```

#### `tracker.path()`

Returns the path that matches this tracker. The base URL of the interceptor is not included, but it is used when matching requests.

```ts
const tracker = interceptor.get('/users');
const path = tracker.path();
console.log(path); // '/users'
```

#### `tracker.respond(declaration)`

Declares a response to return for matched intercepted requests.

When the tracker matches a request, it will respond with the given declaration. The response type is statically validated against the schema of the interceptor.

##### Static responses

```ts
const listTracker = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

##### Computed responses

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

Clears any declared response and saved intercepted requests, and makes the tracker stop matching intercepted requests. The next tracker, created before this one, that matches the same method and path will be used if present. If not, the requests to the method and path will not be intercepted.

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
const updateTracker = interceptor.put('/users/:id').respond((request) => {
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

const updateRequests = updateTracker.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].url).toEqual('http://localhost:3000/users/1');
expect(updateRequests[0].body).toEqual({ username: 'new' });
```

The return by `requests` contains simplified objects based on the [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) web APIs, containing an already parsed body in `.body`. If you need access to the original `Request` and `Response` objects, you can use the `.raw` property:

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
