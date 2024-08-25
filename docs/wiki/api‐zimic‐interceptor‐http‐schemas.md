# API reference: `zimic/interceptor/http` schemas <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [Declaring HTTP paths](#declaring-http-paths)
- [Declaring HTTP methods](#declaring-http-methods)
- [Declaring HTTP requests](#declaring-http-requests)
- [Declaring HTTP responses](#declaring-http-responses)

---

HTTP interceptor schemas define the structure of the real services being mocked. This includes paths, methods, request
and response bodies, and status codes. Interceptors use this schema to type your mocks.

> [!TIP]
>
> If you are using TypeScript and have an [OpenAPI v3](https://swagger.io/specification) schema, you can use
> [`zimic typegen`](cli‐zimic‐typegen) to automatically generate types for your interceptor schema!

<details open>
  <summary>An example of a complete HTTP interceptor schema:</summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

// Declaring base types
interface User {
  username: string;
}

interface UserCreationBody {
  username: string;
}

interface NotFoundError {
  message: string;
}

interface UserCreationResponseHeaders {
  'content-type': string;
}

interface UserListSearchParams {
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}

// Declaring the schema
type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: { accept: string };
        body: UserCreationBody;
      };
      response: {
        201: {
          headers: UserCreationResponseHeaders;
          body: User;
        };
      };
    };
    GET: {
      request: {
        searchParams: UserListSearchParams;
      };
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
}>;

// Creating the interceptor
const interceptor = httpInterceptor.create<MyServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>Alternatively, you can compose the schema using utility types:</summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

// Declaring the base types
interface User {
  username: string;
}

interface UserCreationBody {
  username: string;
}

interface NotFoundError {
  message: string;
}

interface UserCreationResponseHeaders {
  'content-type': string;
}

interface UserListSearchParams {
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}

// Declaring user methods
type UserMethods = HttpSchema.Methods<{
  POST: {
    request: {
      headers: { accept: string };
      body: UserCreationBody;
    };
    response: {
      201: {
        headers: UserCreationResponseHeaders;
        body: User;
      };
    };
  };

  GET: {
    request: {
      searchParams: UserListSearchParams;
    };
    response: {
      200: { body: User[] };
      404: { body: NotFoundError };
    };
  };
}>;

type UserByIdMethods = HttpSchema.Methods<{
  GET: {
    response: {
      200: { body: User };
      404: { body: NotFoundError };
    };
  };
}>;

// Declaring user paths
type UserPaths = HttpSchema<{
  '/users': UserMethods;
}>;

type UserByIdPaths = HttpSchema<{
  '/users/:id': UserByIdMethods;
}>;

// Declaring interceptor schema
type MyServiceSchema = UserPaths & UserByIdPaths;

// Creating the interceptor
const interceptor = httpInterceptor.create<MyServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

## Declaring HTTP paths

At the root level, each key represents a path or route of the service:

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    // Path schema
  };
  '/users/:id': {
    // Path schema
  };
  '/posts': {
    // Path schema
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

<details>
  <summary>
    Alternatively, you can also compose paths using <code>HttpSchema</code>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserPaths = HttpSchema<{
  '/users': {
    // Path schema
  };
  '/users/:id': {
    // Path schema
  };
}>;

type PostPaths = HttpSchema<{
  '/posts': {
    // Path schema
  };
}>;

const interceptor = httpInterceptor.create<UserPaths & PostPaths>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

## Declaring HTTP methods

Each path can have one or more methods, (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`). The method
names are case-sensitive.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      // Method schema
    };
    POST: {
      // Method schema
    };
  };
  // Other paths
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

<details>
  <summary>
    You can also compose methods using <code>HttpSchema.Methods</code>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserMethods = HttpSchema.Methods<{
  GET: {
    // Method schema
  };
  POST: {
    // Method schema
  };
}>;

const interceptor = httpInterceptor.create<{
  '/users': UserMethods;
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

## Declaring HTTP requests

Each method can have a `request`, which defines the schema of the accepted requests. `headers`, `searchParams`, and
`body` are supported to provide type safety when applying mocks.
[Path parameters](api‐zimic‐interceptor‐http#path-parameters) are automatically inferred from the path string, such as
`/users/:id`.

<details open>
  <summary>
    Declaring a request type with <b>search params</b>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

interface UserListSearchParams {
  username?: string;
}

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      request: { searchParams: UserListSearchParams };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a request type with a <b>JSON</b> body:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

interface UserCreationBody {
  username: string;
}

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: UserCreationBody };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

> [!TIP]
>
> The utility type [`JSONValue`](api‐zimic#jsonvalue) is useful to check if your types are compatible with JSON.

> [!TIP]
>
> The utility type [`JSONSerialized`](api‐zimic#jsonserialized) is handy to infer the serialized type of an object. It
> converts `Date`'s to strings, removes function properties and serializes nested objects and arrays.

<details open>
  <summary>
    Declaring a request type with a <b>form data</b> body:
  </summary>

```ts
import { type HttpSchema, type HttpFormData } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type FileUploadData = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/files': {
    POST: {
      request: { body: HttpFormData<FileUploadData> };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a request type with a <b>blob</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: Blob };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a request type with a <b>plain text</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: string };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a request type with a <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

```ts
import { type HttpSchema, type HttpSearchParams } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: { body: HttpSearchParams<UserListSearchParams> };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    You can also compose requests using <code>HttpSchema.Request</code>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

interface UserCreationBody {
  username: string;
}

type UserCreationRequest = HttpSchema.Request<{
  body: UserCreationBody;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      request: UserCreationRequest;
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

## Declaring HTTP responses

Each method can also have a `response`, which defines the schema of the returned responses. The status codes are used as
keys. `headers` and `body` are supported to provide type safety when applying mocks.

Bodies can be a JSON object, [`HttpFormData`](api‐zimic‐http#httpformdata),
[`HttpSearchParams`](api‐zimic‐http#httpsearchparams), `Blob`, or plain text.

<details open>
  <summary>
    Declaring a response type with a <b>JSON</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

interface User {
  username: string;
}

interface NotFoundError {
  message: string;
}

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

> [!TIP]
>
> The utility type [`JSONValue`](api‐zimic#jsonvalue) is useful to check if your types are compatible with JSON.

> [!TIP]
>
> The utility type [`JSONSerialized`](api‐zimic#jsonserialized) is handy to infer the serialized type of an object. It
> converts `Date`'s to strings, removes function properties and serializes nested objects and arrays.

<details open>
  <summary>
    Declaring a response type with a <b>form data</b> body:
  </summary>

```ts
import { type HttpSchema, type HttpFormData } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type FileUploadData = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/files': {
    POST: {
      response: {
        200: { body: HttpFormData<FileUploadData> };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a response type with a <b>blob</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: Blob };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details open>
  <summary>
    Declaring a response type with a <b>plain text</b> body:
  </summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: string };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    Declaring a response type with a <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

```ts
import { type HttpSchema, type HttpSearchParams } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users': {
    POST: {
      response: {
        200: { body: HttpSearchParams<UserListSearchParams> };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>
    You can also compose responses using <code>HttpSchema.ResponseByStatusCode</code> and
    <code>HttpSchema.Response</code>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

interface User {
  username: string;
}

interface NotFoundError {
  message: string;
}

type SuccessUserGetResponse = HttpSchema.Response<{
  body: User;
}>;

type NotFoundUserGetResponse = HttpSchema.Response<{
  body: NotFoundError;
}>;

type UserGetResponses = HttpSchema.ResponseByStatusCode<{
  200: SuccessUserGetResponse;
  404: NotFoundUserGetResponse;
}>;

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    GET: {
      response: UserGetResponses;
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>
