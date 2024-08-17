# Contents <!-- omit from toc -->

- [`zimic/interceptor/http` API reference](#zimicinterceptorhttp-api-reference)
  - [`HttpInterceptor`](#httpinterceptor)
    - [`httpInterceptor.create(options)`](#httpinterceptorcreateoptions)
      - [Creating a local HTTP interceptor](#creating-a-local-http-interceptor)
      - [Creating a remote HTTP interceptor](#creating-a-remote-http-interceptor)
      - [Path discriminators in remote HTTP interceptors](#path-discriminators-in-remote-http-interceptors)
      - [Unhandled requests](#unhandled-requests)
      - [Saving intercepted requests](#saving-intercepted-requests)
    - [Declaring interceptor schemas](#declaring-interceptor-schemas)
      - [Declaring HTTP paths](#declaring-http-paths)
      - [Declaring HTTP methods](#declaring-http-methods)
      - [Declaring HTTP requests](#declaring-http-requests)
      - [Declaring HTTP responses](#declaring-http-responses)
    - [HTTP `interceptor.start()`](#http-interceptorstart)
    - [HTTP `interceptor.stop()`](#http-interceptorstop)
    - [HTTP `interceptor.isRunning()`](#http-interceptorisrunning)
    - [HTTP `interceptor.baseURL()`](#http-interceptorbaseurl)
    - [HTTP `interceptor.platform()`](#http-interceptorplatform)
    - [HTTP `interceptor.<method>(path)`](#http-interceptormethodpath)
      - [Dynamic path parameters](#dynamic-path-parameters)
    - [HTTP `interceptor.clear()`](#http-interceptorclear)
    - [`HttpInterceptor` utility types](#httpinterceptor-utility-types)
      - [`LiteralHttpServiceSchemaPath`](#literalhttpserviceschemapath)
      - [`NonLiteralHttpServiceSchemaPath`](#nonliteralhttpserviceschemapath)
      - [`HttpServiceSchemaPath`](#httpserviceschemapath)
      - [`PathParamsSchemaFromPath`](#pathparamsschemafrompath)
      - [`MergeHttpResponsesByStatusCode`](#mergehttpresponsesbystatuscode)
      - [`ExtractHttpInterceptorSchema`](#extracthttpinterceptorschema)
  - [`HttpRequestHandler`](#httprequesthandler)
    - [HTTP `handler.method()`](#http-handlermethod)
    - [HTTP `handler.path()`](#http-handlerpath)
    - [HTTP `handler.with(restriction)`](#http-handlerwithrestriction)
      - [Static restrictions](#static-restrictions)
      - [Computed restrictions](#computed-restrictions)
    - [HTTP `handler.respond(declaration)`](#http-handlerresponddeclaration)
      - [Static responses](#static-responses)
      - [Computed responses](#computed-responses)
    - [HTTP `handler.bypass()`](#http-handlerbypass)
    - [HTTP `handler.clear()`](#http-handlerclear)
    - [HTTP `handler.requests()`](#http-handlerrequests)
  - [Intercepted HTTP resources](#intercepted-http-resources)

---

# `zimic/interceptor/http` API reference

This module provides resources to create HTTP interceptors for both client-sid and server-side environments.

## `HttpInterceptor`

HTTP interceptors provide the main API to handle HTTP requests and return mock responses. The methods, paths, status
codes, parameters, and responses are statically-typed based on the service schema.

Each interceptor represents a service and can be used to mock its paths and methods.

### `httpInterceptor.create(options)`

Creates an HTTP interceptor, the main interface to intercept HTTP requests and return responses. Learn more about
[declaring interceptor schemas](#declaring-interceptor-schemas).

#### Creating a local HTTP interceptor

A local interceptor is configured with `type: 'local'`. The `baseURL` represents the URL should be matched by this
interceptor. Any request starting with the `baseURL` will be intercepted if a matching [handler](#httprequesthandler)
exists.

```ts
import { JSONValue } from 'zimic';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

#### Creating a remote HTTP interceptor

A remote interceptor is configured with `type: 'remote'`. The `baseURL` points to an
[interceptor server](cli-zimic-server#zimic-server). Any request starting with the `baseURL` will be intercepted if a
matching [handler](#httprequesthandler) exists.

```ts
import { JSONValue } from 'zimic';
import { httpInterceptor } from 'zimic/interceptor/http';

type User = JSONValue<{
  username: string;
}>;

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
      };
    };
  };
}>({
  // The interceptor server is at http://localhost:4000
  // `/my-service` is a path to differentiate from other
  // interceptors using the same server
  type: 'remote',
  baseURL: 'http://localhost:4000/my-service',
});
```

#### Path discriminators in remote HTTP interceptors

A single [interceptor server](cli-zimic-server#zimic-server) is perfectly capable of handling multiple interceptors and
requests. Thus, additional paths are supported and might be necessary to differentiate between conflicting interceptors.
If you may have multiple threads or processes applying mocks concurrently to the same
[interceptor server](cli-zimic-server#zimic-server), it's important to keep the interceptor base URLs unique. Also, make
sure that your application is considering the correct URL when making requests.

```ts
const interceptor = httpInterceptor.create<{
  // ...
}>({
  type: 'remote',
  // Declaring a base URL with a unique identifier to prevent conflicts
  baseURL: `http://localhost:4000/my-service-${crypto.randomUUID()}`,
});

// Your application should use this base URL when making requests
const baseURL = interceptor.baseURL();
```

#### Unhandled requests

When a request is not matched by any interceptor handlers, it is considered unhandled and will be logged to the console
by default.

> [!TIP]
>
> If you expected a request to be handled, but it was not, make sure that the interceptor
> [base URL](#httpinterceptorcreateoptions), [path](#http-interceptormethodpath), [method](#http-interceptormethodpath),
> and [restrictions](#http-handlerwithrestriction) correctly match the request. Additionally, confirm that no errors
> occurred while creating the response.

In a [local interceptor](getting-started#local-http-interceptors), unhandled requests are always bypassed, meaning that
they pass through the interceptor and reach the real network.
[Remote interceptors](getting-started#remote-http-interceptors) in pair with an
[interceptor server](cli-zimic-server#zimic-server) always reject unhandled requests because they cannot be bypassed.

You can override the default logging behavior per interceptor with `onUnhandledRequest` in `httpInterceptor.create()`.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  onUnhandledRequest: { log: false },
});
```

`onUnhandledRequest` also accepts a function to dynamically choose when to ignore an unhandled request. Calling
`await context.log()` logs the request to the console. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  onUnhandledRequest: async (request, context) => {
    const url = new URL(request.url);

    // Ignore only unhandled requests to /assets
    if (!url.pathname.startsWith('/assets')) {
      await context.log();
    }
  },
});
```

If you want to override the default logging behavior for all interceptors, or requests that did not match any known base
URL, you can use `httpInterceptor.default.onUnhandledRequest`. Keep in mind that defining an `onUnhandledRequest` when
creating an interceptor will take precedence over `httpInterceptor.default.onUnhandledRequest`.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

// Example 1: Ignore all unhandled requests
httpInterceptor.default.onUnhandledRequest({ log: false });

// Example 2: Ignore only unhandled requests to /assets
httpInterceptor.default.onUnhandledRequest((request, context) => {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/assets')) {
    await context.log();
  }
});
```

#### Saving intercepted requests

The option `saveRequests` indicates whether [request handlers](#httprequesthandler) should save their intercepted
requests in memory and make them accessible through [`handler.requests()`](#http-handlerrequests).

This setting is configured per interceptor and is `false` by default. If set to `true`, each handler will keep track of
their intercepted requests in memory.

> [!IMPORTANT]
>
> Saving the intercepted requests will lead to a memory leak if not accompanied by clearing of the interceptor or
> disposal of the handlers (i.e. garbage collection).
>
> If you plan on accessing those requests, such as to assert them in your tests, set `saveRequests` to `true` and make
> sure to regularly clear the interceptor. A common practice is to call [`interceptor.clear()`](#http-interceptorclear)
> after each test.
>
> See [Testing](guides-testing#testing) for an example of how to manage the lifecycle of interceptors in your tests.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  saveRequests: true,
});
```

> [!TIP]
>
> If you use an interceptor both in tests and as a standalone mock server, consider setting `saveRequests` based on an
> environment variable. This allows you to access the requests in tests, while preventing memory leaks in long-running
> mock servers.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  saveRequests: process.env.NODE_ENV === 'test',
});
```

### Declaring interceptor schemas

HTTP service schemas define the structure of the real services being mocked. This includes paths, methods, request and
response bodies, and status codes. Based on the schema, interceptors will provide type validation when applying mocks.

<details>
  <summary>An example of a complete interceptor schema:</summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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

// Creating the interceptor
const interceptor = httpInterceptor.create<{
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
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

<details>
  <summary>Alternatively, you can compose the schema using utility types:</summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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
type ServiceSchema = UserPaths & UserByIdPaths;

// Creating the interceptor
const interceptor = httpInterceptor.create<ServiceSchema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});
```

</details>

#### Declaring HTTP paths

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
import { HttpSchema } from 'zimic/http';
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

#### Declaring HTTP methods

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
import { HttpSchema } from 'zimic/http';
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

#### Declaring HTTP requests

Each method can have a `request`, which defines the schema of the accepted requests. `headers`, `searchParams`, and
`body` are supported to provide type safety when applying mocks. [Path parameters](#dynamic-path-parameters) are
automatically inferred from dynamic paths, such as `/users/:id`.

<details open>
  <summary>
    Declaring a request type with <b>search params</b>:
  </summary>

```ts
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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
> The utility type `JSONSerialized`, exported from `zimic`, can be handy to infer the serialized type of an object. It
> converts `Date`'s to strings, removes function properties and serializes nested objects and arrays.

```ts
import { JSONSerialized } from 'zimic/http';

class User {
  name: string;
  age: number;
  createdAt: Date;
  method() {
    // ...
  }
}

type SerializedUser = JSONSerialized<User>;
// { name: string, age: number, createdAt: string }
```

<details>
  <summary>
    Declaring a request type with <b>form data</b> body:
  </summary>

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';
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

<details>
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

<details>
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

<details>
  <summary>
    Declaring a request type with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

```ts
import { HttpSchema, HttpSearchParams } from 'zimic/http';
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
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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

#### Declaring HTTP responses

Each method can also have a `response`, which defines the schema of the returned responses. The status codes are used as
keys. `headers` and `body` are supported to provide type safety when applying mocks.

Bodies can be a JSON object, [`HttpFormData`](api-zimic-http#httpformdata),
[`HttpSearchParams`](api-zimic-http#httpsearchparams), `Blob`, or plain text.

<details open>
  <summary>
    Declaring a response type with <b>JSON</b> body:
  </summary>

```ts
import { JSONValue } from 'zimic';
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

<details>
  <summary>
    Declaring a response type with <b>form data</b> body:
  </summary>

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';
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

<details>
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

<details>
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
import { HttpSchema, HttpSearchParams } from 'zimic/http';
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
import { JSONValue } from 'zimic';
import { HttpSchema } from 'zimic/http';
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

### HTTP `interceptor.start()`

Starts the interceptor. Only interceptors that are running will intercept requests.

```ts
await interceptor.start();
```

When targeting a browser environment with a local interceptor, make sure to follow the
[client-side post-install guide](getting-started#client-side-post-install) before starting your interceptors.

### HTTP `interceptor.stop()`

Stops the interceptor. Stopping an interceptor will also clear its registered handlers and responses.

```ts
await interceptor.stop();
```

### HTTP `interceptor.isRunning()`

Returns whether the interceptor is currently running and ready to use.

```ts
const isRunning = interceptor.isRunning();
```

### HTTP `interceptor.baseURL()`

Returns the base URL of the interceptor.

```ts
const baseURL = interceptor.baseURL();
```

### HTTP `interceptor.platform()`

Returns the platform used by the interceptor (`browser` or `node`).

```ts
const platform = interceptor.platform();
```

### HTTP `interceptor.<method>(path)`

Creates an [`HttpRequestHandler`](#httprequesthandler) for the given method and path. The path and method must be
declared in the interceptor schema.

The supported methods are: `get`, `post`, `put`, `patch`, `delete`, `head`, and `options`.

When using a [remote interceptor](getting-started#remote-http-interceptors), creating a handler is an asynchronous
operation, so you need to `await` it. You can also chain any number of operations and apply them by awaiting the
handler.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

const listHandler = interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      response: {
        200: { body: User[] };
      };
    };
  };
}>({
  type: 'remote',
  baseURL: 'http://localhost:4000/my-service',
});

const listHandler = await interceptor.get('/users').respond({
  status: 200
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr></table>

#### Dynamic path parameters

Paths with dynamic path parameters are supported, such as `/users/:id`. Even when using a computed path (e.g.
`/users/1`), the original path is automatically inferred, guaranteeing type safety.

```ts
import { httpInterceptor } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users/:id': {
    PUT: {
      request: {
        body: { username: string };
      };
      response: {
        204: {};
      };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

interceptor.get('/users/:id'); // Matches any id
interceptor.get(`/users/${1}`); // Only matches id 1
```

`request.pathParams` contains the parsed path parameters of a request and have their type automatically inferred from
the path string. For example, the path `/users/:userId` will result in a `request.pathParams` of type
`{ userId: string }`.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const updateHandler = interceptor.put('/users/:id').respond((request) => {
  console.log(request.pathParams); // { id: '1' }

  return {
    status: 200,
    body: { username: 'diego-aquino' },
  };
});

await fetch('http://localhost:3000/users/1', { method: 'PUT' });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const updateHandler = await interceptor.put('/users/:id').respond((request) => {
  console.log(request.pathParams); // { id: '1' }

  return {
    status: 200,
    body: { username: 'diego-aquino' },
  };
});

await fetch('http://localhost:3000/users/1', { method: 'PUT' });
```

</details></td></tr></table>

### HTTP `interceptor.clear()`

Clears all of the [`HttpRequestHandler`](#httprequesthandler) instances created by this interceptor, including their
registered responses and intercepted requests. After calling this method, the interceptor will no longer intercept any
requests until new mock responses are registered.

This method is useful to reset the interceptor mocks between tests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
interceptor.clear();
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
await interceptor.clear();
```

</details></td></tr></table>

### `HttpInterceptor` utility types

#### `LiteralHttpServiceSchemaPath`

Extracts the literal paths from an HTTP service schema containing certain methods. Only the methods defined in the
schema are allowed.

```ts
type LiteralPath = LiteralHttpServiceSchemaPath<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    GET: {
      response: { 200: { body: User } };
    };
  };
}>;
// "/users" | "/users/:userId"
```

#### `NonLiteralHttpServiceSchemaPath`

Extracts the non-literal paths from an HTTP service schema containing certain methods.

```ts
type NonLiteralPath = NonLiteralHttpServiceSchemaPath<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    GET: {
      response: { 200: { body: User } };
    };
  };
}>;
// "/users" | "/users/${string}"
```

#### `HttpServiceSchemaPath`

Extracts the paths from an HTTP service schema containing certain methods.

```ts
type Path = NonLiteralHttpServiceSchemaPath<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
  '/users/:userId': {
    GET: {
      response: { 200: { body: User } };
    };
  };
}>;
// "/users" | "/users/:userId" | "/users/${string}"
```

#### `PathParamsSchemaFromPath`

Infers the path parameters schema from a path string.

```ts
type PathParams = PathParamsSchemaFromPath<'/users/:userId/notifications'>;
// { userId: string }
```

#### `MergeHttpResponsesByStatusCode`

Merges multiple HTTP response schemas by status code into a single schema. When there are duplicate status codes, the
first declaration takes precedence.

```ts
// Overriding the 400 status code with a more specific schema and using a generic schema for all other client errors.
type MergedResponses = MergeHttpResponsesByStatusCode<
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
    GET: { response: MergedResponses };
  };
}>;
```

#### `ExtractHttpInterceptorSchema`

Extracts the schema of an [HTTP interceptor](#httpinterceptor).

```ts
import { httpInterceptor, type ExtractHttpInterceptorSchema } from 'zimic/interceptor/http';

const interceptor = httpInterceptor.create<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
}>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

type Schema = ExtractHttpInterceptorSchema<typeof interceptor>;
// {
//   '/users': {
//     GET: {
//       response: { 200: { body: User[] } };
//     };
//   };
// }
```

## `HttpRequestHandler`

HTTP request handlers allow declaring HTTP responses to return for intercepted requests. They also keep track of the
intercepted requests and their responses, which can be used to check if the requests your application has made are
correct.

When multiple handlers match the same method and path, the _last_ created with
[`interceptor.<method>(path)`](#http-interceptormethodpath) will be used.

### HTTP `handler.method()`

Returns the method that matches a handler.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const handler = interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const handler = await interceptor.post('/users');
const method = handler.method();
console.log(method); // 'POST'
```

</details></td></tr></table>

### HTTP `handler.path()`

Returns the path that matches a handler. The base URL of the interceptor is not included, but it is used when matching
requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const handler = interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const handler = await interceptor.get('/users');
const path = handler.path();
console.log(path); // '/users'
```

</details></td></tr></table>

### HTTP `handler.with(restriction)`

Declares a restriction to intercepted requests. `headers`, `searchParams`, and `body` are supported to limit which
requests will match the handler and receive the mock response. If multiple restrictions are declared, either in a single
object or with multiple calls to `handler.with()`, all of them must be met, essentially creating an AND condition.

#### Static restrictions

<details open>
  <summary>
    Declaring restrictions for <b>headers</b>:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .get('/users')
  .with({
    headers: { authorization: `Bearer ${token}` },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    headers: { authorization: `Bearer ${token}` },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpHeaders`](api-zimic-http#httpheaders):

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const headers = new HttpHeaders<Partial<UserListHeaders>>();
headers.set('authorization', `Bearer ${token}`);

const creationHandler = interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const headers = new HttpHeaders<Partial<UserListHeaders>>();
headers.set('authorization', `Bearer ${token}`);

const creationHandler = await interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>
</details>

<details open>
  <summary>
    Declaring restrictions for <b>search params</b>:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .get('/users')
  .with({
    searchParams: { username: 'diego-aquino' },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    searchParams: { username: 'diego-aquino' },
  })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpSearchParams`](api-zimic-http#httpsearchparams):

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const searchParams = new HttpSearchParams<Partial<UserListSearchParams>>();
searchParams.set('username', 'diego-aquino');

const creationHandler = interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const searchParams = new HttpSearchParams<Partial<UserListSearchParams>>();
searchParams.set('username', 'diego-aquino');

const creationHandler = await interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>
</details>

<details open>
  <summary>
    Declaring restrictions for a <b>JSON</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: { username: 'diego-aquino' },
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: { username: 'diego-aquino' },
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For JSON bodies to be correctly parsed, make sure that the intercepted requests have the header
`content-type: application/json`.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>form data</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<Partial<UserCreationData>>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const creationHandler = interceptor
  .post('/users')
  .with({
    body: formData,
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<Partial<UserCreationData>>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const creationHandler = await interceptor
  .post('/users')
  .with({
    body: formData,
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For form data bodies to be correctly parsed, make sure that the intercepted requests have the header
`content-type: multipart/form-data`.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>blob</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: new Blob(['content'], {
      type: 'application/octet-stream',
    }),
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: new Blob(['content'], {
      type: 'application/octet-stream',
    }),
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For blob bodies to be correctly parsed, make sure that the intercepted requests have the header `content-type`
indicating a binary data, such as `application/octet-stream`, `image/png`, `audio/mp3`, etc.

</details>

<details>
  <summary>
    Declaring restrictions for a <b>plain text</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    body: 'content',
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: 'content',
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

For plain text bodies to be correctly parsed, make sure that the intercepted requests have the header `content-type`
indicating a plain text, such as `text/plain`.

</details>

By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
match the handler, regardless of having more properties or values. In the examples above, requests with more properties
in the headers, search params, or body would still match the restrictions.

If you want to match only requests with the exact values declared, you can use `exact: true`:

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'diego-aquino' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'diego-aquino' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'diego-aquino' },
  });
```

</details></td></tr></table>

#### Computed restrictions

A function is also supported to declare restrictions in case they are dynamic. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 201,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 201,
    body: [{ username: 'diego-aquino' }],
  });
```

</details></td></tr></table>

The function should return a boolean: `true` if the request matches the handler and should receive the mock response;
`false` otherwise.

### HTTP `handler.respond(declaration)`

Declares a response to return for matched intercepted requests.

When the handler matches a request, it will respond with the given declaration. The response type is statically
validated against the schema of the interceptor.

#### Static responses

<details open>
  <summary>
    Declaring responses with <b>JSON</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>form data</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const listHandler = interceptor.get('/users/:id').respond({
  status: 200,
  body: formData,
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'diego-aquino');
formData.append(
  'profilePicture',
  new File(['content'], 'profile.png', {
    type: 'image/png',
  }),
);

const listHandler = await interceptor.get('/users/:id').respond({
  status: 200,
  body: formData,
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>blob</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: new Blob(['content'], {
    type: 'application/octet-stream',
  }),
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: new Blob(['content'], {
    type: 'application/octet-stream',
  }),
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>plain text</b> body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: 'content',
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: 'content',
});
```

</details></td></tr></table>
</details>

<details>
  <summary>
    Declaring responses with <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { HttpSearchParams } from 'zimic/http';

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  username: 'diego-aquino',
});

const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: searchParams,
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { HttpSearchParams } from 'zimic/http';

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  username: 'diego-aquino',
});

const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: searchParams,
});
```

</details></td></tr></table>
</details>

#### Computed responses

A function is also supported to declare a response in case it is dynamic. Learn more about the `request` object at
[Intercepted HTTP resources](#intercepted-http-resources).

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');

  if (!username) {
    return { status: 400 };
  }

  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond((request) => {
  const username = request.searchParams.get('username');

  if (!username) {
    return { status: 400 };
  }

  return {
    status: 200,
    body: [{ username }],
  };
});
```

</details></td></tr></table>

### HTTP `handler.bypass()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with
[`handler.respond(declaration)`](#http-handlerresponddeclaration).

This method is useful to skip a handler. It is more gentle than [`handler.clear()`](#http-handlerclear), as it only
removed the response, keeping restrictions and intercepted requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

otherListHandler.bypass();
// Now, requests GET /users will match `listHandler` and receive an empty array
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

await otherListHandler.bypass();
// Now, requests GET /users will match `listHandler` and receive an empty array
```

</details></td></tr></table>

### HTTP `handler.clear()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), restrictions
declared with [`handler.with(restriction)`](#http-handlerwithrestriction), and intercepted requests, making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with `handler.respond()`.

This method is useful to reset handlers to a clean state between tests. It is more aggressive than
[`handler.bypass()`](#http-handlerbypass), as it also clears restrictions and intercepted requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

otherListHandler.clear();
// Now, requests GET /users will match `listHandler` and receive an empty array

otherListHandler.requests(); // Now empty
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const otherListHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'diego-aquino' }],
});

await otherListHandler.clear();
// Now, requests GET /users will match `listHandler` and receive an empty array

await otherListHandler.requests(); // Now empty
```

</details></td></tr></table>

### HTTP `handler.requests()`

Returns the intercepted requests that matched this handler, along with the responses returned to each of them. This is
useful for testing that the correct requests were made by your application. Learn more about the `request` and
`response` objects at [Intercepted HTTP resources](#intercepted-http-resources).

> [!IMPORTANT]
>
> This method can only be used if `saveRequests` was set to `true` when creating the interceptor. See
> [Saving intercepted requests](#saving-intercepted-requests) for more information.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const updateHandler = interceptor.put('/users/:id').respond((request) => {
  const newUsername = request.body.username;
  return {
    status: 200,
    body: [{ username: newUsername }],
  };
});

await fetch(`http://localhost:3000/users/${1}`, {
  method: 'PUT',
  body: JSON.stringify({ username: 'new' }),
});

const updateRequests = await updateHandler.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].pathParams).toEqual({ id: '1' });
expect(updateRequests[0].body).toEqual({ username: 'new' });
expect(updateRequests[0].response.status).toBe(200);
expect(updateRequests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
const updateHandler = await interceptor.put('/users/:id').respond((request) => {
  const newUsername = request.body.username;
  return {
    status: 200,
    body: [{ username: newUsername }],
  };
});

await fetch(`http://localhost:3000/users/${1}`, {
  method: 'PUT',
  body: JSON.stringify({ username: 'new' }),
});

const updateRequests = await updateHandler.requests();
expect(updateRequests).toHaveLength(1);
expect(updateRequests[0].pathParams).toEqual({ id: '1' });
expect(updateRequests[0].body).toEqual({ username: 'new' });
expect(updateRequests[0].response.status).toBe(200);
expect(updateRequests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td></tr></table>

## Intercepted HTTP resources

The intercepted requests and responses are typed based on their [interceptor schema](#declaring-interceptor-schemas).
They are available as simplified objects based on the
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) web APIs. `body` contains the parsed body, while
typed headers, path params and search params are in `headers`, `pathParams`, and `searchParams`, respectively.

The body is automatically parsed based on the header `content-type` of the request or response. The following table
shows how each type is parsed, where `*` indicates any other resource that does not match the previous types:

| `content-type`                      | Parsed to                                             |
| ----------------------------------- | ----------------------------------------------------- |
| `application/json`                  | `JSON`                                                |
| `application/xml`                   | `String`                                              |
| `application/x-www-form-urlencoded` | [`HttpSearchParams`](api-zimic-http#httpsearchparams) |
| `application/*` (others)            | `Blob`                                                |
| `multipart/form-data`               | [`HttpFormData`](api-zimic-http#httpformdata)         |
| `multipart/*` (others)              | `Blob`                                                |
| `text/*`                            | `String`                                              |
| `image/*`                           | `Blob`                                                |
| `audio/*`                           | `Blob`                                                |
| `font/*`                            | `Blob`                                                |
| `video/*`                           | `Blob`                                                |
| `*/*` (others)                      | `JSON` if possible, otherwise `String`                |

If no `content-type` exists or it is unknown, Zimic tries to parse the body as JSON and falls back to plain text if it
fails.

If you need access to the original `Request` and `Response` objects, you can use the `request.raw` property:

```ts
console.log(request.raw); // Request{}
console.log(request.response.raw); // Response{}
```