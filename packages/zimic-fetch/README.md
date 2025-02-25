<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/fetch
</h1>

<p align="center">
  TypeScript-first fetch-like API client
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/fetch">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/wiki">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/5">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)
[![NPM Downloads](https://img.shields.io/npm/dm/@zimic/fetch?style=flat&logo=npm&color=0E69BE&label=Downloads&labelColor=353C43)](https://www.npmjs.com/package/@zimic/fetch)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)&nbsp;

</div>

---

- [Features](#features)
- [Getting started](#getting-started)
  - [Installation](#installation)
- [Basic usage](#basic-usage)
- [Documentation](#documentation)
- [Examples](#examples)
- [Changelog](#changelog)
- [Contributing](#contributing)

---

`@zimic/fetch` is a lightweight, thoroughly tested, TypeScript-first HTTP request interceptor and mock library.

## Features

`@zimic/fetch` provides a flexible and type-safe way to intercept and mock HTTP requests.

- :sparkles: **Type-safe `fetch`**: Create a type-safe
  [`fetch` -like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Import your `@zimic/http`
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas) and have your requests and
  responses fully typed by default.
- :muscle: **Developer experience**: While mostly compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API), `@zimic/fetch` provides a more ergonomic
  interface for common use cases. Define defaults to apply to all of your requests, such as a base URL, headers, search
  parameters, and more. Inspect and modify requests and responses using `onRequest` and `onResponse` listeners.

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐fetch).

### Installation

| Manager | Command                                       |
| :-----: | --------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/fetch --save` |
|  yarn   | `yarn add @zimic/http @zimic/fetch`           |
|  pnpm   | `pnpm add @zimic/http @zimic/fetch`           |

Note that `@zimic/fetch` requires `@zimic/http` as a peer dependency.

## Basic usage

1.  Declare your types:

    ```ts
    interface User {
      username: string;
    }

    interface RequestError {
      code: string;
      message: string;
    }
    ```

2.  Declare your HTTP schema using `@zimic/http`
    ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http‐schemas)):

    ```ts
    import { type HttpSchema } from '@zimic/http';

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
            searchParams: { username?: string; limit?: `${number}` };
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

3.  Create your fetch client ([learn more](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetchoptions)):

    ```ts
    import { createFetch } from '@zimic/fetch';

    const fetch = createFetch<MySchema>({
      baseURL: 'http://localhost:3000',
    });
    ```

4.  Enjoy requests and responses typed by default!

    ```ts
    const response = await fetch('/users', {
      method: 'GET',
      searchParams: { username: 'my', limit: '10' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('User not found');
      }

      throw response.error;
    }

    const users = await response.json();
    console.log(users); // [{ username: 'my-user' }]
    ```

## Documentation

- [Introduction](https://github.com/zimicjs/zimic/wiki)
- [Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐fetch)
- [API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch)

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases.

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](../../CONTRIBUTING.md) to get started!
