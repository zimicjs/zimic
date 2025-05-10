> [!TIP]
>
> Zimic's documentation is now available on [zimic.dev](https://zimic.dev/docs/fetch/getting-started)! :tada:
>
> Check it out for the latest updates, guides, and documentation.

# `@zimic/fetch` - Getting started <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [1. Requirements](#1-requirements)
  - [Supported environments](#supported-environments)
  - [Supported languages](#supported-languages)
- [2. Installation](#2-installation)
- [3. Create your fetch instance](#3-create-your-fetch-instance)
- [6. Next steps](#6-next-steps)

---

[`@zimic/fetch`](../../packages/zimic-fetch) is a minimal (~2 kB minified and gzipped), zero-dependency, and type-safe
`fetch`-like API client.

## 1. Requirements

### Supported environments

- If you are on the **client side**:
  - Any relatively modern browser
- If you are on the **server side**:
  - [Node](https://nodejs.org) >= 18.0.0

### Supported languages

- [TypeScript](https://www.typescriptlang.org) >= 4.8
- [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript) >= ES6
  - `@zimic/fetch` is fully functional on JavaScript, but consider using TypeScript for improved type safety and editor
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

`@zimic/fetch` is available on [npm](https://www.npmjs.com/package/@zimic/fetch).

| Manager | Command                                           |
| :-----: | ------------------------------------------------- |
|   npm   | `npm install @zimic/http @zimic/fetch --save-dev` |
|  yarn   | `yarn add @zimic/http @zimic/fetch --dev`         |
|  pnpm   | `pnpm add @zimic/http @zimic/fetch --dev`         |

We also canary releases under the tag `canary`, containing the latest features and bug fixes:

| Manager | Command                                                         |
| :-----: | --------------------------------------------------------------- |
|   npm   | `npm install @zimic/http@canary @zimic/fetch@canary --save-dev` |
|  yarn   | `yarn add @zimic/http@canary @zimic/fetch@canary --dev`         |
|  pnpm   | `pnpm add @zimic/http@canary @zimic/fetch@canary --dev`         |

## 3. Create your fetch instance

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
              limit?: number;
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

    You can also use [`zimic-http typegen`](cli‐zimic‐typegen) to automatically generate types for your HTTP schema.

2.  Create your [fetch instance](https://github.com/zimicjs/zimic/wiki/api‐zimic‐fetch#createfetch):

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
      searchParams: { query: 'u', limit: 10 },
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

## 6. Next steps

- Check out [`@zimic/interceptor`](../../packages/zimic-interceptor) if you'd like to intercept and mock HTTP requests
  during development or in your tests:

  - [`@zimic/interceptor`](../../packages/zimic-interceptor) provides a flexible and type-safe way to intercept and mock
    HTTP requests. Use your HTTP schema to type your interceptors and create realistic mocks in development and testing.

- Take a look at our [examples](../../examples/README.md).

- Check out the API reference:

- [`createFetch(options)`](api‐zimic‐fetch#createfetch)
- [`fetch`](api‐zimic‐fetch#fetch)
  - [`fetch.defaults`](api‐zimic‐fetch#fetchdefaults)
  - [`fetch.loose`](api‐zimic‐fetch#fetchloose)
  - [`fetch.onRequest`](api‐zimic‐fetch#fetchonrequest)
  - [`fetch.onResponse`](api‐zimic‐fetch#fetchonresponse)
  - [`fetch.isRequest`](api‐zimic‐fetch#fetchisrequest)
  - [`fetch.isResponse`](api‐zimic‐fetch#fetchisresponse)
  - [`fetch.isResponseError`](api‐zimic‐fetch#fetchisresponseerror)
- [`FetchRequest`](api‐zimic‐fetch#fetchrequest)
- [`FetchResponse`](api‐zimic‐fetch#fetchresponse)
- [`FetchResponseError`](api‐zimic‐fetch#fetchresponseerror)

- View our guides on common use cases:

  - [Using headers](api‐zimic‐fetch#using-headers)
  - [Using search params (query)](api‐zimic‐fetch#using-search-params-query)
  - [Using bodies](api‐zimic‐fetch#using-bodies)
    - [Using a JSON body](api‐zimic‐fetch#using-a-json-body)
    - [Using a `FormData` body](api‐zimic‐fetch#using-a-formdata-body)
    - [Using a file or binary body](api‐zimic‐fetch#using-a-file-or-binary-body)
  - [Handling authentication](api‐zimic‐fetch#handling-authentication)
  - [Handling errors](api‐zimic‐fetch#handling-errors)
