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

// Or infer the params from the path string
type UserByIdPathParams = InferPathParams<Schema, '/users/:userId'>;
```
