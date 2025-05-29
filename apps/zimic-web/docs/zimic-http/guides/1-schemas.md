---
title: Declaring schemas | @zimic/http
sidebar_label: Declaring schemas
slug: /http/guides/schemas
---

# Declaring schemas

A central part of `@zimic/http` is an HTTP schema, which is a TypeScript type describing the structure of an API. The
schema serves as a centralized source of truth about paths, parameters, and returns of the service, and can be used to
automatically type your requests and responses with [`@zimic/fetch`](/docs/zimic-fetch/1-index.md) and
[`@zimic/interceptor`](/docs/zimic-interceptor/1-index.md).

:::tip TIP: <span>OpenAPI Typegen</span>

For APIs with an [OpenAPI documentation](https://www.openapis.org) (e.g. [Swagger](https://swagger.io)), the
[`zimic-http typegen` CLI](/docs/zimic-http/guides/2-typegen.mdx) can automatically infer the types and generate the
schema for you. This is a great way to keep your schema is up to date and save time on manual type definitions.

:::

A `@zimic/http` schema is defined with the `HttpSchema` type.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

// Declaring the base types
interface User {
  name: string;
  username: string;
}

interface UserCreationBody {
  name: string;
  username: string;
}

interface UserListSearchParams {
  name?: string;
  orderBy?: ('name:asc' | 'name:desc')[];
}

// Declaring the schema
// highlight-next-line
type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        body: UserCreationBody;
      };
      response: {
        201: { body: User };
        400: { body: { message?: string; issues?: string[] } };
        409: { body: { message?: string } };
      };
    };

    GET: {
      request: {
        headers: { authorization: string };
        searchParams: UserListSearchParams;
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };

  '/users/:id': {
    GET: {
      request: {
        headers: { authorization: string };
      };
      response: {
        200: { body: User };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        404: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };
}>;
```

This example contains three endpoints, `POST /users`, `GET /users`, and `GET /users/:id`, each with their own request
and response types. `GET /users` and `GET /users/:userId` require authentication via the `authorization` header.
`POST /users` receive a body with some data, while `GET /users` accepts search parameters to filter the results. All
three endpoints have successful and error responses, detailed with their respective status codes and body types.

## Declaring paths

At the root of the schema, you declare the paths of the API as keys. Path parameters are automatically inferred from the
path and have `:` as prefix, followed by the name of the parameter.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  // highlight-next-line
  '/users': {
    // ...
  };
  // highlight-next-line
  '/users/:id': {
    // ...
  };
  // highlight-next-line
  '/posts': {
    // ...
  };
}>;
```

## Declaring methods

Each path can have one or more HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`). The method
names are case-sensitive and must be in uppercase.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  '/users': {
    // highlight-next-line
    GET: {
      // ...
    };

    // highlight-next-line
    POST: {
      // ...
    };
  };

  // ...
}>;
```

## Declaring requests

Each method can have a `request` property, which defines the shape of the requests accepted in the endpoint.

### Declaring requests with search params

Search parameters (query) are declared in the `searchParams` property.

```ts
import { HttpSchema } from '@zimic/http';

interface UserListSearchParams {
  query?: string;
}

type MyServiceSchema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        // highlight-next-line
        searchParams: UserListSearchParams;
      };
    };
  };
}>;
```

### Declaring requests with body

#### Declaring requests with JSON body

To declare a JSON body, use the type directly.

```ts
import { HttpSchema } from '@zimic/http';

interface UserCreationBody {
  username: string;
}

type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        // highlight-next-line
        body: UserCreationBody;
      };
    };
  };
}>;
```

#### Declaring requests with `FormData` body

Use [`HttpFormData`](/docs/zimic-http/api/4-http-form-data.md) to declare a request with `FormData` body.

```ts
import { HttpSchema, HttpFormData } from '@zimic/http';

interface FileUploadData {
  files: File[];
  description?: string;
}

type MyServiceSchema = HttpSchema<{
  '/files': {
    POST: {
      request: {
        // highlight-next-line
        body: HttpFormData<FileUploadData>;
      };
    };
  };
}>;
```

#### Declaring requests with binary body

[`Blob`](https://developer.mozilla.org/docs/Web/API/Blob),
[`ArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), and
[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream) are frequently used types for binary data.
Use one of these types to declare a binary body.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  '/upload': {
    POST: {
      request: {
        // highlight-next-line
        body: Blob;
      };
    };
  };
}>;
```

#### Declaring requests with plain-text body

Plain-text bodies can be declared as a string.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  '/content': {
    POST: {
      request: {
        // highlight-next-line
        body: string;
      };
    };
  };
}>;
```

#### Declaring requests with URL-encoded body

Bodies with URL-encoded data can be declared with [`HttpSearchParams`](/docs/zimic-http/api/3-http-search-params.md).

```ts
import { HttpSchema, HttpSearchParams } from '@zimic/http';

interface UserCreationSearchParams {
  query?: string;
}

type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        body: HttpSearchParams<UserCreationSearchParams>;
      };
    };
  };
}>;
```

## Declaring responses

Each method can also have a `response`, which defines the schema of the results returned by the server. The status codes
are used as keys.

### Declaring responses with body

#### Declaring responses with JSON body

To declare a response with a JSON body, use the type directly.

```ts
interface User {
  name: string;
  username: string;
}

type MyServiceSchema = HttpSchema<{
  '/users/:id': {
    GET: {
      response: {
        200: {
          // highlight-next-line
          body: User;
        };
        404: {
          // highlight-next-line
          body: { message?: string };
        };
      };
    };
  };
}>;
```

#### Declaring responses with `FormData` body

To declare a response with `FormData`, use [`HttpFormData`](/docs/zimic-http/api/4-http-form-data.md).

```ts
import { HttpSchema, HttpFormData } from '@zimic/http';

interface FileUploadData {
  files: File[];
  description?: string;
}

type MyServiceSchema = HttpSchema<{
  '/files': {
    POST: {
      response: {
        200: {
          // highlight-next-line
          body: HttpFormData<FileUploadData>;
        };
      };
    };
  };
}>;
```

#### Declaring responses with binary body

To define a response with binary data, use [`Blob`](https://developer.mozilla.org/docs/Web/API/Blob),
[`ArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), or
[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream), similar to how you would declare a
request with binary data.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  '/upload': {
    POST: {
      response: {
        // highlight-next-line
        200: { body: Blob };
      };
    };
  };
}>;
```

#### Declaring responses with plain-text body

Plain-text bodies can be declared as a string.

```ts
import { HttpSchema } from '@zimic/http';

type MyServiceSchema = HttpSchema<{
  '/content': {
    POST: {
      response: {
        200: {
          // highlight-next-line
          body: string;
        };
      };
    };
  };
}>;
```

#### Declaring responses with URL-encoded body

Use [`HttpSearchParams`](/docs/zimic-http/api/3-http-search-params.md) to declare a response with URL-encoded data.

```ts
import { HttpSchema, HttpSearchParams } from '@zimic/http';

interface UserCreationSearchParams {
  query?: string;
}

type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      response: {
        200: {
          // highlight-next-line
          body: HttpSearchParams<UserCreationSearchParams>;
        };
      };
    };
  };
}>;
```

### Declaring responses with status code ranges

Sometimes, endpoints can return a range of status codes, such as `5XX`, meaning any status greater than or equal to 500.
In these cases, you can use the `HttpStatusCode` type, which contains all standard HTTP status codes:

| Type                         | Range                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `HttpStatusCode.Information` | [`1XX`](https://developer.mozilla.org/docs/Web/HTTP/Status#information_responses)  |
| `HttpStatusCode.Success`     | [`2XX`](https://developer.mozilla.org/docs/Web/HTTP/Status#successful_responses)   |
| `HttpStatusCode.Redirection` | [`3XX`](https://developer.mozilla.org/docs/Web/HTTP/Status#redirection_messages)   |
| `HttpStatusCode.ClientError` | [`4XX`](https://developer.mozilla.org/docs/Web/HTTP/Status#client_error_responses) |
| `HttpStatusCode.ServerError` | [`5XX`](https://developer.mozilla.org/docs/Web/HTTP/Status#server_error_responses) |

```ts
import type { HttpSchema, HttpStatusCode } from '@/index';

interface User {
  name: string;
  username: string;
}

export type MyServiceSchema = HttpSchema<{
  '/users': {
    GET: {
      // highlight-start
      response: {
        200: User[];
      } & {
        // 4XX
        [StatusCode in HttpStatusCode.ClientError]: {
          body: { message?: string; code: 'client_error' };
        };
      } & {
        // 5XX
        [StatusCode in HttpStatusCode.ServerError]: {
          body: { message?: string; code: 'server_error' };
        };
      };
      // highlight-end
    };
  };
}>;
```

In this example, `GET /users` may return a successful response with a `200` status code, or any status code in the `4XX`
(`HttpStatusCode.ClientError`) or `5XX` (`HttpStatusCode.ServerError`) ranges.
