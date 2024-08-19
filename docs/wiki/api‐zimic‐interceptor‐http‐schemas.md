# API reference: `zimic/interceptor/http` schemas <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [Declaring HTTP paths](#declaring-http-paths)
- [Declaring HTTP methods](#declaring-http-methods)
- [Declaring HTTP requests](#declaring-http-requests)
- [Declaring HTTP responses](#declaring-http-responses)

---

HTTP interceptor schemas define the structure of the real services being mocked. This includes paths, methods, request
and response bodies, and status codes. Interceptors use this schema to type your mocks.

<details open>
  <summary>An example of a complete HTTP interceptor schema:</summary>

```ts
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

// Declaring base types
type User = JSONValue<{
  username: string;
}>;

type UserCreationBody = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

type UserListSearchParams = HttpSchema.SearchParams<{
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}>;

// Declaring the schema
type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    POST: {
      request: {
        headers: { accept: string };
        body: UserCreationBody;
      };
      response: {
        201: {
          headers: { 'content-type': string };
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
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

// Declaring the base types
type User = JSONValue<{
  username: string;
}>;

type UserCreationBody = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

type UserListSearchParams = HttpSchema.SearchParams<{
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}>;

// Declaring user methods
type UserMethods = HttpSchema.Methods<{
  POST: {
    request: {
      headers: { accept: string };
      body: UserCreationBody;
    };
    response: {
      201: {
        headers: { 'content-type': string };
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
type UserPaths = HttpSchema.Paths<{
  '/users': UserMethods;
}>;

type UserByIdPaths = HttpSchema.Paths<{
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
    Alternatively, you can also compose paths using the utility type <code>HttpSchema.Paths</code>:
  </summary>

```ts
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserPaths = HttpSchema.Paths<{
  '/users': {
    // Path schema
  };
  '/users/:id': {
    // Path schema
  };
}>;

type PostPaths = HttpSchema.Paths<{
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
    Similarly to <a href="#declaring-http-paths">paths</a>, you can also compose methods using the utility type
    <code>HttpSchema.Methods</code>:
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
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  username?: string;
}>;

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
    Declaring a request type with <b>JSON</b> body:
  </summary>

```ts
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserCreationBody = JSONValue<{
  username: string;
}>;

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

> [!IMPORTANT]
>
> JSON body types cannot be declared using TypeScript interfaces, because they do not have implicit index signatures as
> types do. Part of Zimic's JSON validation relies on index signatures. To workaround this, you can declare JSON bodies
> using `type`. As an extra step to make sure the type is a valid JSON, you can use the utility type `JSONValue`.

> [!TIP]
>
> The utility type [`JSONSerialized`](api‐zimic#jsonserialized) can be handy to infer the serialized type of an object.
> It converts `Date`'s to strings, removes function properties and serializes nested objects and arrays.

<details open>
  <summary>
    Declaring a request type with <b>form data</b> body:
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
    Declaring a request type with <b>blob</b> body:
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
    Declaring a request type with <b>plain text</b> body:
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
    Declaring a request type with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
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

> [!TIP]
>
> You only need to include in the schema the properties you want to use in your mocks. Headers, search params, or body
> fields that are not used do not need to be declared, keeping your type definitions clean and concise.

<details>
  <summary>
    You can also compose requests using the utility type <code>HttpSchema.Request</code>, similarly to
    <a href="#declaring-http-methods">methods</a>:
  </summary>

```ts
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type UserCreationBody = JSONValue<{
  username: string;
}>;

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
    Declaring a response type with <b>JSON</b> body:
  </summary>

```ts
import { type JSONValue } from 'zimic';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

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

> [!IMPORTANT]
>
> Also similarly to [declaring HTTP requests](#declaring-http-requests), JSON body types cannot be declared using
> TypeScript interfaces, because they do not have implicit index signatures as types do. Part of Zimic's JSON validation
> relies on index signatures. To workaround this, you can declare bodies using `type`. As an extra step to make sure the
> type is a valid JSON, you can use the utility type `JSONValue`.

<details open>
  <summary>
    Declaring a response type with <b>form data</b> body:
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
    Declaring a response type with <b>blob</b> body:
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
    Declaring a response type with <b>plain text</b> body:
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
    Declaring a response type with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
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

> [!TIP]
>
> Similarly to [declaring HTTP requests](#declaring-http-requests), you only need to include in the schema the
> properties you want to use in your mocks. Headers, search params, or body fields that are not used do not need to be
> declared, keeping your type definitions clean and concise.

<details>
  <summary>
    You can also compose responses using the utility types <code>HttpSchema.ResponseByStatusCode</code> and
    <code>HttpSchema.Response</code>, similarly to <a href="#declaring-http-requests">requests</a>:
  </summary>

```ts
import { type JSONValue } from 'zimic';
import { type HttpSchema } from 'zimic/http';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

type NotFoundError = JSONValue<{
  message: string;
}>;

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
