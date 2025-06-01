---
title: HttpSchema | @zimic/http
sidebar_label: HttpSchema
slug: /http/api/http-schema
---

# `HttpSchema`

Declares the schema of an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        headers: {
          accept: string;
        };
        searchParams: {
          name?: string;
          limit?: number;
        };
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;
```

**Related**:

- [Guides - Declaring schemas](/docs/zimic-http/guides/1-schemas.md)

## `HttpSchema.Methods`

Declares the method schemas of a path in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserMethods = HttpSchema.Methods<{
  GET: {
    response: {
      200: { body: User[] };
    };
  };
}>;

type Schema = HttpSchema<{
  '/users': UserMethods;
}>;
```

## `HttpSchema.Method`

Declares a method schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListMethod = HttpSchema.Method<{
  response: {
    200: { body: User[] };
  };
}>;

type Schema = HttpSchema<{
  '/users': {
    GET: UserListMethod;
  };
}>;
```

## `HttpSchema.Request`

Declares a request schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserCreationRequest = HttpSchema.Request<{
  headers: { 'content-type': 'application/json' };
  body: User;
}>;

type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: UserCreationRequest;
      response: {
        201: { body: User };
      };
    };
  };
}>;
```

## `HttpSchema.ResponseByStatusCode`

Declares the response schemas of an HTTP method by status code.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListResponseByStatusCode = HttpSchema.ResponseByStatusCode<{
  200: { body: User[] };
  400: { body: { message: string } };
}>;

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: UserListResponseByStatusCode;
    };
  };
}>;
```

## `MergeHttpResponsesByStatusCode`

Merges multiple HTTP response schemas by status code into a single schema. When there are duplicate status codes, the
first declaration takes precedence.

```ts
import { HttpSchema, HttpStatusCode, MergeHttpResponsesByStatusCode } from '@zimic/http';

// Overriding the 400 status code with a more specific schema
// and using a generic schema for all other client errors.
type MergedResponseByStatusCode = MergeHttpResponsesByStatusCode<
  [
    {
      400: { body: { message: string; issues: string[] } };
    },
    {
      [StatusCode in HttpStatusCode.ClientError]: { body: { message: string } };
    },
  ]
>;
// {
//   400: { body: { message: string; issues: string[] } };
//   401: { body: { message: string}; };
//   402: { body: { message: string}; };
//   403: { body: { message: string}; };
//   ...
// }

type Schema = HttpSchema<{
  '/users': {
    GET: { response: MergedResponseByStatusCode };
  };
}>;
```

## `HttpSchema.Response`

Declares a response schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListSuccessResponse = HttpSchema.Response<{
  body: User[];
}>;

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: {
        200: UserListSuccessResponse;
      };
    };
  };
}>;
```

## `HttpSchema.Body`

Declares a body schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListSuccessResponseBody = HttpSchema.Body<User[]>;

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: {
        200: { body: UserListSuccessResponseBody };
      };
    };
  };
}>;
```

## `HttpSchema.Headers`

Declares a headers schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListHeaders = HttpSchema.Headers<{
  accept: 'application/json';
}>;

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        headers: UserListHeaders;
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;
```

## `HttpSchema.SearchParams`

Declares a search params schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  limit: `${number}`;
  offset: `${number}`;
}>;

type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: UserListSearchParams;
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;
```

## `HttpSchema.FormData`

Declares a form data schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema, HttpFormData } from '@zimic/http';

type UserCreationFormData = HttpFormData<
  HttpSchema.FormData<{
    name: string;
    email: string;
  }>
>;

type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        body: UserCreationFormData;
      };
      response: {
        201: { body: User };
      };
    };
  };
}>;
```

## `HttpSchema.PathParams`

Declares a path params schema in an HTTP service.

```ts title='schema.ts'
import { HttpSchema, InferPathParams } from '@zimic/http';

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>;

type UserByIdPathParams = HttpSchema.PathParams<{
  userId: string;
}>;
```

## `HttpSchemaPath`

Extracts the [literal](#httpschemapathliteral) and [non-literal](#httpschemapathnonliteral) paths from an HTTP service
schema. Optionally receives a second argument with one or more methods to filter the paths with. Only the methods
defined in the schema are allowed.

```ts
import { HttpSchema, HttpSchemaPath } from '@zimic/http';

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    DELETE: {
      response: { 200: { body: User } };
    };
  };
}>;

type Path = HttpSchemaPath<Schema>;
// "/users" | "/users/:userId" | "/users/${string}"

type GetPath = HttpSchemaPath<Schema, 'GET'>;
// "/users"
```

### `HttpSchemaPath.Literal`

Extracts the literal paths from an HTTP service schema. Optionally receives a second argument with one or more methods
to filter the paths with. Only the methods defined in the schema are allowed.

```ts
import { HttpSchema, LiteralHttpSchemaPath } from '@zimic/http';

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    DELETE: {
      response: { 200: { body: User } };
    };
  };
}>;

type LiteralPath = LiteralHttpSchemaPath<Schema>;
// "/users" | "/users/:userId"

type LiteralGetPath = LiteralHttpSchemaPath<Schema, 'GET'>;
// "/users"
```

### `HttpSchemaPath.NonLiteral`

Extracts the non-literal paths from an HTTP service schema. Optionally receives a second argument with one or more
methods to filter the paths with. Only the methods defined in the schema are allowed.

```ts
import { HttpSchema, NonLiteralHttpSchemaPath } from '@zimic/http';

type Schema = HttpSchema<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    DELETE: {
      response: { 200: { body: User } };
    };
  };
}>;

type NonLiteralPath = NonLiteralHttpSchemaPath<Schema>;
// "/users" | "/users/${string}"

type NonLiteralGetPath = NonLiteralHttpSchemaPath<Schema, 'GET'>;
// "/users"
```

## `InferPathParams`

Infers the path parameters schema from a path string. If the first argument is a schema (recommended), the second
argument is checked to be a valid path in that schema.

```ts
import { HttpSchema, InferPathParams } from '@zimic/http';

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: { 200: { body: User } };
    };
  };
}>;

// Using a schema to validate the path (recommended):
type PathParams = InferPathParams<Schema, '/users/:userId'>;
// { userId: string }
```
