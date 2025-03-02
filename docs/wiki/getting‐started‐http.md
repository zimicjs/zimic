# `@zimic/http` - Getting started <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [1. Requirements](#1-requirements)
  - [Supported environments](#supported-environments)
  - [Supported languages](#supported-languages)
- [2. Installation](#2-installation)
- [3. Create your HTTP schema](#3-create-your-http-schema)
- [4. Next steps](#4-next-steps)

---

[`@zimic/http`](../../packages/zimic-http) is a collection of type-safe utilities to handle HTTP requests and responses,
including headers, search params, and form data.

## 1. Requirements

### Supported environments

- If you are on the **client side**:
  - Any relatively modern browser
- If you are on the **server side**:
  - [Node](https://nodejs.org) >= 18.0.0

### Supported languages

- [TypeScript](https://www.typescriptlang.org) >= 4.8
  - If you plan on using [`zimic-http typegen`](cli‐zimic‐typegen), we recommend
    [TypeScript](https://www.typescriptlang.org) >= 5.0.
- [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript) >= ES6
  - `@zimic/http` is fully functional on JavaScript, but consider using TypeScript for improved type safety and editor
    support.

If you are using TypeScript, we recommend enabling `strict` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## 2. Installation

`@zimic/http` is available on [npm](https://www.npmjs.com/package/@zimic/http).

| Manager | Command                              |
| :-----: | ------------------------------------ |
|   npm   | `npm install @zimic/http --save-dev` |
|  yarn   | `yarn add @zimic/http --dev`         |
|  pnpm   | `pnpm add @zimic/http --dev`         |

We also canary releases under the tag `canary`, containing the latest features and bug fixes:

| Manager | Command                                     |
| :-----: | ------------------------------------------- |
|   npm   | `npm install @zimic/http@canary --save-dev` |
|  yarn   | `yarn add @zimic/http@canary --dev`         |
|  pnpm   | `pnpm add @zimic/http@canary --dev`         |

## 3. Create your HTTP schema

1. To start using `@zimic/http`, create your [HTTP schema](api‐zimic‐http‐schemas):

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

   You can also use [`zimic-http typegen`](cli‐zimic‐typegen) to automatically generate types for your interceptor
   schema.

## 4. Next steps

- Check out [`@zimic/fetch`](../../packages/zimic-fetch) and [`@zimic/interceptor`](../../packages/zimic-interceptor):

  - [`@zimic/fetch`](../../packages/zimic-fetch) is a minimal (1 kB minified and gzipped), zero-dependency, and
    type-safe `fetch`-like API client. Use your HTTP schema to automatically type your requests and responses.
  - [`@zimic/interceptor`](../../packages/zimic-interceptor) provides a flexible and type-safe way to intercept and mock
    HTTP requests. Use your HTTP schema to type your interceptors and create realistic mocks in development and testing.

- Take a look at our [examples](../../examples/README.md).

- Check out the API reference:
  - [`HttpHeaders`](api‐zimic‐http#httpheaders)
  - [`HttpSearchParams`](api‐zimic‐http#httpsearchparams)
  - [`HttpFormData`](api‐zimic‐http#httpformdata)
  - [Utility types](api‐zimic‐http#utility-types)
