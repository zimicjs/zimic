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
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/fetch](https://img.shields.io/npm/dm/@zimic/fetch?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Ffetch&labelColor=353C43)](https://www.npmjs.com/package/@zimic/fetch)&nbsp;
[![Bundle size - @zimic/fetch](https://badgen.net/bundlephobia/minzip/@zimic/fetch?color=0E69BE&labelColor=353C43&label=@zimic/fetch%20min%20gzip)](https://bundlephobia.com/package/@zimic/fetch)<br />

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

`@zimic/fetch` is a minimal (1 kB minified and gzipped), zero-dependency, and type-safe `fetch`-like API client.

> [!WARNING]
>
> :construction: This library is **experimental**.

## Features

- :sparkles: **Type-safe `fetch`**: Create a type-safe
  [`fetch`-like](https://developer.mozilla.org/docs/Web/API/Fetch_API) API client. Use your
  [`@zimic/http` schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and have your requests and
  responses fully typed by default.
- :muscle: **Developer experience**: `@zimic/fetch` seeks to be as compatible with the
  [native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API) as possible, while providing an ergonomic
  interface to improve type safety. Define default options to apply to your requests, such as a base URL, headers,
  search parameters, and more. Inspect and modify requests and responses using
  [`onRequest`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchonrequest) and
  [`onResponse`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#fetchonresponse) listeners.

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐fetch).

### Installation

| Manager | Command                                       |
| :-----: | --------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/fetch --save` |
|  yarn   | `yarn add @zimic/http @zimic/fetch`           |
|  pnpm   | `pnpm add @zimic/http @zimic/fetch`           |

## Basic usage

1.  Declare your HTTP schema using [`@zimic/http`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http):

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
            searchParams: {
              query?: string;
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
    ```

2.  Create your [fetch client](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetch):

    ```ts
    import { createFetch } from '@zimic/fetch';

    const fetch = createFetch<Schema>({
      baseURL: 'http://localhost:3000',
    });
    ```

3.  Enjoy requests and responses typed by default!

    ```ts
    const response = await fetch('/users', {
      method: 'GET',
      searchParams: { query: 'u', limit: '10' },
    });

    if (response.status === 404) {
      return null; // User not found
    }

    if (!response.ok) {
      throw response.error;
    }

    const users = await response.json();
    return users; // User[]
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
