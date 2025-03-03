<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/http
</h1>

<p align="center">
  TypeScript-first HTTP utilities
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/http">npm</a>
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

[![NPM Downloads - @zimic/http](https://img.shields.io/npm/dm/@zimic/http?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Fhttp&labelColor=353C43)](https://www.npmjs.com/package/@zimic/http)&nbsp;
[![Bundle size - @zimic/http](https://badgen.net/bundlephobia/minzip/@zimic/http?color=0E69BE&labelColor=353C43&label=@zimic/http%20min%20gzip)](https://bundlephobia.com/package/@zimic/http)<br />

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

`@zimic/http` is a collection of type-safe utilities to handle HTTP requests and responses, including headers, search
params, and form data.

> [!NOTE]
>
> :seedling: This library is in **beta**.

## Features

- :star: **HTTP schemas and typegen**: Declare the structure of your HTTP endpoints as a TypeScript
  [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas) and use it to type your HTTP requests and
  responses. If you have an [OpenAPI v3](https://swagger.io/specification) declaration,
  [`zimic-http typegen`](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen) can automatically generate the types
  of your schema.
- :pushpin: **Type-safe native APIs**: Declare type-safe
  [`Headers`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpheaders),
  [`URLSearchParams`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparams), and
  [`FormData`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpformdata) objects, fully compatible with their
  native counterparts.

## Getting started

Check our [getting started guide](https://github.com/zimicjs/zimic/wiki/getting‐started‐http).

### Installation

| Manager | Command                          |
| :-----: | -------------------------------- |
|   npm   | `npm install @zimic/http --save` |
|  yarn   | `yarn add @zimic/http`           |
|  pnpm   | `pnpm add @zimic/http`           |

## Basic usage

1. Declare your [schema](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http‐schemas):

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

2. Use the types in your code!

   - **Example 1**: Reference the types in your code:

     ```ts
     import { HttpHeaders, HttpSearchParams, HttpFormData } from '@zimic/http';

     type UserListHeaders = Schema['/users']['GET']['request']['headers'];

     const headers = new HttpHeaders<UserListHeaders>({
       authorization: 'Bearer token',
     });

     type UserListSearchParams = Schema['/users']['GET']['request']['searchParams'];

     const searchParams = new HttpSearchParams<UserListSearchParams>({
       query: 'u',
       limit: '10',
     });

     type UserCreateBody = Schema['/users']['POST']['request']['body'];

     const formData = new HttpFormData<UserCreateBody>();
     formData.append('username', 'user');
     ```

   - **Example 2**: Using [`@zimic/fetch`](../zimic-fetch):

     ```ts
     import { createFetch } from '@zimic/fetch';

     const fetch = createFetch<Schema>({
       baseURL: 'http://localhost:3000',
     });

     const response = await fetch('/users', {
       method: 'POST',
       body: { username: 'user' },
     });

     if (!response.ok) {
       throw response.error;
     }

     console.log(await response.json()); // { username: 'user' }
     ```

   - **Example 3**: Using [`@zimic/interceptor`](../zimic-interceptor):

     ```ts
     import { httpInterceptor } from '@zimic/interceptor/http';

     const interceptor = httpInterceptor.create<Schema>({
       type: 'local',
       baseURL: 'http://localhost:3000',
     });

     await interceptor.start();

     interceptor.post('/users').respond({
       status: 201,
       body: { username: body.username },
     });
     ```

## Documentation

- [Getting started](https://github.com/zimicjs/zimic/wiki/getting‐started‐http)
- [API reference](https://github.com/zimicjs/zimic/wiki/api‐zimic‐http)
- CLI reference
  - [`zimic-http typegen`](https://github.com/zimicjs/zimic/wiki/cli‐zimic‐typegen)

## Examples

Visit our [examples](../../examples/README.md) to see how to use Zimic with popular frameworks, libraries, and use
cases.

## Changelog

The changelog is available on our [GitHub Releases](https://github.com/zimicjs/zimic/releases) page.

## Contributing

Interested in contributing to Zimic? Check out our [contributing guide](../../CONTRIBUTING.md) to get started!
