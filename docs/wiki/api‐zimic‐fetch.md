# API reference: `@zimic/fetch` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`createFetch(options)`](#createfetchoptions)
- [`fetch`](#fetch)
  - [`fetch.defaults`](#fetchdefaults)
  - [`fetch.Request`](#fetchrequest)
  - [`fetch.onRequest`](#fetchonrequest)
  - [`fetch.onResponse`](#fetchonresponse)
  - [`fetch.isRequest`](#fetchisrequest)
  - [`fetch.isResponse`](#fetchisresponse)
  - [`fetch.isResponseError`](#fetchisresponseerror)
- [`FetchRequest`](#fetchrequest-1)
- [`FetchResponse`](#fetchresponse)
- [`FetchResponseError`](#fetchresponseerror)
- [Guides](#guides)
  - [Using headers](#using-headers)
  - [Using search params (query)](#using-search-params-query)
  - [Using bodies](#using-bodies)
    - [Using a JSON body](#using-a-json-body)
    - [Using a `FormData` body](#using-a-formdata-body)
    - [Using a file or binary body](#using-a-file-or-binary-body)
  - [Handling authentication](#handling-authentication)
  - [Handling errors](#handling-errors)

---

`@zimic/fetch` is a lightweight, thoroughly tested, TypeScript-first HTTP request interceptor and mock library.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

## `createFetch(options)`

Creates a [`fetch`](#fetch) instance typed with an HTTP schema, closely compatible with the
[native Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API). All requests and responses are typed by
default with the schema, including methods, paths, status codes, parameters, and bodies.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';

interface User {
  username: string;
}

type MySchema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: User };
      response: { 201: { body: User } };
    };

    GET: {
      request: {
        searchParams: { username?: string; limit?: `${number}` };
      };
      response: { 200: { body: User[] } };
    };
  };
}>;

const fetch = createFetch<MySchema>({
  baseURL: 'http://localhost:3000',
});
```

Requests sent by the fetch instance have their URL automatically prefixed with the base URL of the instance.
[Default options](#fetchdefaults) are also applied to the requests, if provided.

```ts
const response = await fetch('/users', {
  method: 'GET',
  searchParams: { username: 'my', limit: '10' },
});

const users = await response.json();
console.log(users); // [{ username: 'my-user' }]
```

## `fetch`

### `fetch.defaults`

### `fetch.Request`

### `fetch.onRequest`

### `fetch.onResponse`

### `fetch.isRequest`

### `fetch.isResponse`

### `fetch.isResponseError`

## `FetchRequest`

## `FetchResponse`

## `FetchResponseError`

## Guides

### Using headers

### Using search params (query)

### Using bodies

#### Using a JSON body

#### Using a `FormData` body

#### Using a file or binary body

### Handling authentication

### Handling errors
