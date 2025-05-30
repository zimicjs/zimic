> [!TIP]
>
> Zimic's documentation is now available on [zimic.dev](https://zimic.dev)! :tada:
>
> Check it out for the latest updates, guides, and documentation.

# `@zimic/interceptor/http` - API reference <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`HttpInterceptor`](#httpinterceptor)
  - [`createHttpInterceptor(options)`](#createhttpinterceptoroptions)
    - [Creating a local HTTP interceptor](#creating-a-local-http-interceptor)
    - [Creating a remote HTTP interceptor](#creating-a-remote-http-interceptor)
      - [Path discriminators in remote HTTP interceptors](#path-discriminators-in-remote-http-interceptors)
      - [Remote interceptor authentication](#remote-interceptor-authentication)
    - [Unhandled requests](#unhandled-requests)
    - [Saving requests](#saving-requests)
  - [HTTP `interceptor.start()`](#http-interceptorstart)
  - [HTTP `interceptor.stop()`](#http-interceptorstop)
  - [HTTP `interceptor.isRunning`](#http-interceptorisrunning)
  - [HTTP `interceptor.baseURL`](#http-interceptorbaseurl)
  - [HTTP `interceptor.platform`](#http-interceptorplatform)
  - [HTTP `interceptor.<method>(path)`](#http-interceptormethodpath)
    - [Path parameters](#path-parameters)
  - [HTTP `interceptor.checkTimes()`](#http-interceptorchecktimes)
  - [HTTP `interceptor.clear()`](#http-interceptorclear)
  - [`HttpInterceptor` utility types](#httpinterceptor-utility-types)
    - [`InferHttpInterceptorSchema`](#inferhttpinterceptorschema)
- [`HttpRequestHandler`](#httprequesthandler)
  - [HTTP `handler.method`](#http-handlermethod)
  - [HTTP `handler.path`](#http-handlerpath)
  - [HTTP `handler.with(restriction)`](#http-handlerwithrestriction)
    - [Static restrictions](#static-restrictions)
    - [Computed restrictions](#computed-restrictions)
  - [HTTP `handler.respond(declaration)`](#http-handlerresponddeclaration)
    - [Static responses](#static-responses)
    - [Computed responses](#computed-responses)
  - [HTTP `handler.times()`](#http-handlertimes)
  - [HTTP `handler.checkTimes()`](#http-handlerchecktimes)
  - [HTTP `handler.clear()`](#http-handlerclear)
  - [HTTP `handler.requests`](#http-handlerrequests)
- [Intercepted HTTP resources](#intercepted-http-resources)
- [Guides](#guides)

---

`zimic/interceptor/http` exports resources to create HTTP interceptors and mock HTTP responses.

## `HttpInterceptor`

HTTP interceptors provide the main API to handle HTTP requests and return mock responses. The methods, paths, status
codes, parameters, and responses are statically-typed based on the service schema.

Each interceptor represents a service and can be used to mock its paths and methods.

### `createHttpInterceptor(options)`

Creates an HTTP interceptor, the main interface to intercept HTTP requests and return responses. Learn more about
[declaring interceptor schemas](api‐zimic‐interceptor‐http‐schemas).

> [!TIP]
>
> If you are using TypeScript and have an [OpenAPI v3](https://swagger.io/specification) schema, you can use
> [`zimic-http typegen`](cli‐zimic‐typegen) to automatically generate types for your interceptor schema!

#### Creating a local HTTP interceptor

A local interceptor is configured with `type: 'local'`. If the type is not specified, `local` is considered the default.
The `baseURL` represents the URL should be matched by this interceptor. Any request starting with the `baseURL` will be
intercepted if a matching [handler](#httprequesthandler) exists.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

interface User {
  username: string;
}

const interceptor = createHttpInterceptor<{
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
[interceptor server](cli‐zimic‐server). Any request starting with the `baseURL` will be intercepted if a matching
[handler](#httprequesthandler) exists.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

interface User {
  username: string;
}

const interceptor = createHttpInterceptor<{
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

##### Path discriminators in remote HTTP interceptors

A single [interceptor server](cli‐zimic‐server) is perfectly capable of handling multiple interceptors and requests.
Thus, additional paths are supported and might be necessary to differentiate between conflicting interceptors. If you
may have multiple threads or processes applying mocks concurrently to the same [interceptor server](cli‐zimic‐server),
it's important to keep the interceptor base URLs unique. Also, make sure that your application is considering the
correct URL when making requests.

```ts
const interceptor = createHttpInterceptor<{
  // ...
}>({
  type: 'remote',
  // Declaring a base URL with a unique identifier to prevent conflicts
  baseURL: `http://localhost:4000/my-service-${crypto.randomUUID()}`,
});

// Your application should use this base URL when making requests
console.log(interceptor.baseURL);
```

##### Remote interceptor authentication

When connecting to an [interceptor server requiring authentication](cli‐zimic‐server#authentication), use the
`auth.token` option to specify a [token](cli‐zimic‐server#zimic-interceptor-server-token-create) to authenticate the
interceptor. This option is only available for remote interceptors.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  type: 'remote',
  baseURL: 'http://localhost:4000/my-service',
  auth: { token: '<token>' },
});
```

Replace `<token>` with the token you created. See [Interceptor server authentication](cli‐zimic‐server#authentication)
for more details.

#### Unhandled requests

See https://zimic.dev/docs/interceptor/guides/http/unhandled-requests.

#### Saving requests

The `requestSaving` option configures if the intercepted requests are saved and how they are handled. It supports the
following properties:

| Property    | Description                                                                                                                                                                                                                                                                                                                                                                                             | Default                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `enabled`   | Whether [request handlers](#httprequesthandler) should save their intercepted requests in memory and make them accessible through [`handler.requests`](#http-handlerrequests). If you are using [interceptor.checkTimes()](#http-interceptorchecktimes) or [handler.checkTimes()](#http-handlerchecktimes), consider enabling this option to get more detailed information in `TimesCheckError` errors. | `process.env.NODE_ENV === 'test'` |
| `safeLimit` | The safe number of requests to save in memory before logging warnings in the console. If `requestSaving.enabled` is true and the interceptor is not regularly cleared with [`interceptor.clear()`](#http-interceptorclear), the requests may accumulate in memory and cause performance issues. This option does not limit the number of saved requests, only when to log warnings.                     | `1000`                            |

> [!IMPORTANT]
>
> If `requestSaving.enabled` is `true`, make sure to regularly clear the interceptor to avoid requests accumulating in
> memory. A common practice is to call [`interceptor.clear()`](#http-interceptorclear) after each test.
>
> See [Testing](guides‐testing‐interceptor) for an example of how to manage the lifecycle of interceptors in your tests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
  requestSaving: { enabled: true, safeLimit: 1000 },
});

// Recommended: Clear the interceptor after each test.
// Use the equivalent of `afterEach` in your test framework.
afterEach(() => {
  interceptor.clear();
});
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  type: 'remote',
  baseURL: 'http://localhost:3000',
  requestSaving: { enabled: true, safeLimit: 1000 },
});

// Recommended: Clear the interceptor after each test.
// Use the equivalent of `afterEach` in your test framework.
afterEach(async () => {
  await interceptor.clear();
});
```

</details></td></tr></table>

### HTTP `interceptor.start()`

Starts the interceptor. Only interceptors that are running will intercept requests.

```ts
await interceptor.start();
```

When targeting a browser environment with a local interceptor, make sure to follow the
[client-side post-install guide](getting‐started‐interceptor#client-side-post-install) before starting your
interceptors.

### HTTP `interceptor.stop()`

Stops the interceptor, preventing it from intercepting HTTP requests. Stopped interceptors are automatically cleared,
exactly as if [`interceptor.clear()`](#http-interceptorclear) had been called.

```ts
await interceptor.stop();
```

### HTTP `interceptor.isRunning`

Whether the interceptor is currently running and ready to use.

```ts
const isRunning = interceptor.isRunning;
```

### HTTP `interceptor.baseURL`

The base URL of the interceptor.

```ts
console.log(interceptor.baseURL);
```

### HTTP `interceptor.platform`

The platform used by the interceptor (`browser` or `node`).

```ts
console.log(interceptor.platform);
```

### HTTP `interceptor.<method>(path)`

Creates an [`HttpRequestHandler`](#httprequesthandler) for the given method and path. The path and method must be
declared in the interceptor schema. The supported methods are: `get`, `post`, `put`, `patch`, `delete`, `head`, and
`options`.

When using a [remote interceptor](getting‐started‐interceptor#remote-http-interceptors), creating a handler is an
asynchronous operation, so you need to `await` it. You can also chain any number of operations and apply them by
awaiting the handler.

After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
interceptor, and the method, path, [restrictions](#http-handlerwithrestriction), and
[limits on the number of requests](#http-handlertimes) of the handler. The handlers are checked from the **last** one
created to the first one, so new handlers have preference over older ones. This allows you to declare generic and
specific handlers based on their order of creation. For example, a generic handler for `GET /users` can return an empty
list, while a specific handler in a test case can return a list with some users. In this case, the specific handler will
be considered first as long as it is created **after** the generic one.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<{
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
  body: [{ username: 'me' }],
});
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<{
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
  body: [{ username: 'me' }],
});
```

</details></td></tr></table>

#### Path parameters

See https://zimic.dev/docs/interceptor/guides/path-params.

### HTTP `interceptor.checkTimes()`

Checks if all handlers created by this interceptor have matched the number of requests declared with
[`handler.times()`](#http-handlertimes).

If some handler has matched fewer or more requests than expected, this method will throw a `TimesCheckError` error,
including a stack trace to the [`handler.times()`](#http-handlertimes) that was not satisfied.

> [!TIP]
>
> When [`requestSaving.enabled`](#saving-requests) is `true` in your interceptor, the `TimesCheckError` errors will also
> list each unmatched request with diff of the expected and received data. This is useful for debugging requests that
> did not match a handler with [restrictions](#http-handlerwithrestriction).

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
interceptor.checkTimes();
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
await interceptor.checkTimes();
```

</details></td></tr></table>

This is useful in an `afterEach` hook (or equivalent) to make sure that all expected requests were made at the end of
each test.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
afterEach(() => {
  interceptor.checkTimes();
});
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
afterEach(async () => {
  await interceptor.checkTimes();
});
```

</details></td></tr></table>

See [Testing](guides‐testing‐interceptor) for an example of how to manage the lifecycle of interceptors in your tests.

### HTTP `interceptor.clear()`

Clears the interceptor and all of its [`HttpRequestHandler`](#httprequesthandler) instances, including their registered
responses and intercepted requests. After calling this method, the interceptor will no longer intercept any requests
until new mock responses are registered.

This method is useful to reset the interceptor mocks between tests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
interceptor.clear();
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
await interceptor.clear();
```

</details></td></tr></table>

### `HttpInterceptor` utility types

#### `InferHttpInterceptorSchema`

Infers the schema of an [HTTP interceptor](#httpinterceptor).

```ts
import { type InferHttpInterceptorSchema } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<{
  '/users': {
    GET: {
      response: { 200: { body: User[] } };
    };
  };
}>({ baseURL: 'http://localhost:3000' });

type Schema = InferHttpInterceptorSchema<typeof interceptor>;
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

### HTTP `handler.method`

Returns the method that matches a handler.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const handler = interceptor.post('/users');
console.log(handler.method); // 'POST'
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const handler = await interceptor.post('/users');
console.log(handler.method); // 'POST'
```

</details></td></tr></table>

### HTTP `handler.path`

Returns the path that matches a handler. The base URL of the interceptor is not included, but it is used when matching
requests.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const handler = interceptor.get('/users');
console.log(handler.path); // '/users'
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const handler = await interceptor.get('/users');
console.log(handler.path); // '/users'
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
    body: [{ username: 'me' }],
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    headers: { authorization: `Bearer ${token}` },
  })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpHeaders`](api‐zimic‐http#httpheaders):

<table><tr><td width="900px" valign="top"><details><summary><b>Using a local interceptor</b></summary>

```ts
import { type HttpSchema, HttpHeaders } from '@zimic/http';

type UserListHeaders = HttpSchema.Headers<{
  authorization: string;
}>;

const headers = new HttpHeaders<UserListHeaders>({
  authorization: `Bearer ${token}`,
});

const creationHandler = interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpHeaders } from '@zimic/http';

type UserListHeaders = HttpSchema.Headers<{
  authorization: string;
}>;

const headers = new HttpHeaders<UserListHeaders>({
  authorization: `Bearer ${token}`,
});

const creationHandler = await interceptor
  .get('/users')
  .with({ headers })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
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
    searchParams: { query: 'u' },
  })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .get('/users')
  .with({
    searchParams: { query: 'u' },
  })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  });
```

</details></td></tr></table>

An equivalent alternative using [`HttpSearchParams`](api‐zimic‐http#httpsearchparams):

<table><tr><td width="900px" valign="top"><details><summary><b>Using a local interceptor</b></summary>

```ts
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  query?: string;
}>;

const searchParams = new HttpSearchParams<UserListSearchParams>({
  query: 'u',
});

const creationHandler = interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  });
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserListSearchParams = HttpSchema.SearchParams<{
  query?: string;
}>;

const searchParams = new HttpSearchParams<UserListSearchParams>({
  query: 'u',
});

const creationHandler = await interceptor
  .get('/users')
  .with({ searchParams })
  .respond({
    status: 200,
    body: [{ username: 'me' }],
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
    body: { username: 'me' },
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: { username: 'me' },
  })
  .respond({
    status: 201,
    body: { username: 'me' },
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
import { type HttpSchema, HttpFormData } from '@zimic/http';

type UserCreationData = HttpSchema.FormData<{
  username: string;
  profilePicture: Blob;
}>;

const formData = new HttpFormData<UserCreationData>();
formData.append('username', 'me');
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
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpFormData } from '@zimic/http';

type UserCreationData = HttpSchema.FormData<{
  username: string;
  profilePicture: Blob;
}>;

const formData = new HttpFormData<UserCreationData>();
formData.append('username', 'me');
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
    body: { username: 'me' },
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
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

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
    body: { username: 'me' },
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
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    body: 'content',
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td></tr></table>

<details>
  <summary>
    Declaring restrictions for <b>search params</b> (<code>x-www-form-urlencoded</code>) body:
  </summary>

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserGetByIdSearchParams = HttpSchema.SearchParams<{
  username: string;
}>;

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  query: 'u',
});

const creationHandler = interceptor
  .post('/users')
  .with({
    body: searchParams,
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserGetByIdSearchParams = HttpSchema.SearchParams<{
  username: string;
}>;

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  query: 'u',
});

const creationHandler = await interceptor
  .post('/users')
  .with({
    body: searchParams,
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td></tr></table>

For plain text bodies to be correctly parsed, make sure that the intercepted requests have the header `content-type`
indicating a plain text, such as `text/plain`.

</details>

By default, restrictions use `exact: false`, so requests having more properties still match the handler, as long as **at
least** the restrictions are met. In the examples above, requests with more headers, search params, or body attributes
would still match the restrictions.

If you want to match only requests with exact values, you can use `exact: true`:

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const creationHandler = interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'me' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with({
    headers: { 'content-type': 'application/json' },
    body: { username: 'me' },
    exact: true, // Only requests with these exact headers and body will match
  })
  .respond({
    status: 201,
    body: { username: 'me' },
  });
```

</details></td></tr></table>

</details>

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
    body: [{ username: 'me' }],
  });
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const creationHandler = await interceptor
  .post('/users')
  .with((request) => {
    const accept = request.headers.get('accept');
    return accept !== null && accept.startsWith('application');
  })
  .respond({
    status: 201,
    body: [{ username: 'me' }],
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
  body: [{ username: 'me' }],
});
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'me' }],
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
import { type HttpSchema, HttpFormData } from '@zimic/http';

type UserGetByIdData = HttpSchema.FormData<{
  username: string;
  profilePicture: Blob;
}>;

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'me');
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

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpFormData } from '@zimic/http';

type UserGetByIdData = HttpSchema.FormData<{
  username: string;
  profilePicture: Blob;
}>;

const formData = new HttpFormData<UserGetByIdData>();
formData.append('username', 'me');
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

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

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

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

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
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserGetByIdSearchParams = HttpSchema.SearchParams<{
  username: string;
}>;

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  query: 'u',
});

const listHandler = interceptor.get('/users').respond({
  status: 200,
  body: searchParams,
});
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
import { type HttpSchema, HttpSearchParams } from '@zimic/http';

type UserGetByIdSearchParams = HttpSchema.SearchParams<{
  username: string;
}>;

const searchParams = new HttpSearchParams<UserGetByIdSearchParams>({
  query: 'u',
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

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

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

### HTTP `handler.times()`

Declares a number of intercepted requests that the handler will be able to match and return its response.

If only one argument is provided, the handler will match exactly that number of requests. In case of two arguments, the
handler will consider an inclusive range, matching at least the minimum (first argument) and at most the maximum (second
argument) number of requests.

Once the handler receives more requests than the maximum number declared, it will stop matching requests and returning
its response. In this case, Zimic will try other handlers until one eligible is found, otherwise the request will be
either bypassed or rejected. Learn more about how Zimic decides which handler to use for an intercepted request in the
[`interceptor.<method>(path)` API reference](#http-interceptormethodpath).

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const exactListHandler = interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  })
  .times(1); // Matches exactly one request

const rangeListHandler = interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  })
  .times(0, 3); // Matches at least 0 and at most 3 requests
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const exactListHandler = await interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  })
  .times(1); // Matches exactly one request

const rangeListHandler = await interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [{ username: 'me' }],
  })
  .times(0, 3); // Matches at least 0 and at most 3 requests
```

</details></td></tr></table>

> [!IMPORTANT]
>
> To make sure that all expected requests were made, use [`interceptor.checkTimes()`](#http-interceptorchecktimes) or
> [`handler.checkTimes()`](#http-handlerchecktimes). [`interceptor.checkTimes()`](#http-interceptorchecktimes) is
> generally preferred, as it checks all handlers created by the interceptor with a single call.

> [!TIP]
>
> Prior to v0.12.0, a common strategy to check the number of requests was to assert the length of `handler.requests`.
> [`handler.times()`](#http-handlertimes), combined with [`handler.checkTimes()`](#http-handlerchecktimes) or
> [`interceptor.checkTimes()`](#http-interceptorchecktimes), archives the same purpose in a shorter and more declarative
> way. In most cases, these methods are preferred over manually checking the length of `handler.requests`.

### HTTP `handler.checkTimes()`

Checks if the handler has matched the expected number of requests declared with [`handler.times()`](#http-handlertimes).

If the handler has matched fewer or more requests than expected, this method will throw a `TimesCheckError` error,
including a stack trace to the [`handler.times()`](#http-handlertimes) that was not satisfied.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const listHandler = interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [],
  })
  .times(1);

// Run application...

// Check that exactly 1 request was made
handler.checkTimes();
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const listHandler = await interceptor
  .get('/users')
  .respond({
    status: 200,
    body: [],
  })
  .times(1);

// Run application...

// Check that exactly 1 request was made
await handler.checkTimes();
```

</details></td></tr></table>

### HTTP `handler.clear()`

Clears any response declared with [`handler.respond(declaration)`](#http-handlerresponddeclaration), restrictions
declared with [`handler.with(restriction)`](#http-handlerwithrestriction), and intercepted requests, making the handler
stop matching requests. The next handler, created before this one, that matches the same method and path will be used if
present. If not, the requests of the method and path will not be intercepted.

To make the handler match requests again, register a new response with `handler.respond()`.

<table><tr><td width="900px" valign="top"><details open><summary><b>Using a local interceptor</b></summary>

```ts
const genericHandler = interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const specificHandler = interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'me' }],
});

specificHandler.clear();
// Now, requests GET /users will match `genericHandler` and receive an empty array

console.log(specificHandler.requests); // []
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

```ts
const genericHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [],
});

const specificHandler = await interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'me' }],
});

await specificHandler.clear();
// Now, requests GET /users will match `genericHandler` and receive an empty array

console.log(specificHandler.requests); // []
```

</details></td></tr></table>

### HTTP `handler.requests`

Returns the intercepted requests that matched this handler, along with the responses returned to each of them. This is
useful for testing that the correct requests were made by your application. Learn more about the `request` and
`response` objects at [Intercepted HTTP resources](#intercepted-http-resources).

> [!IMPORTANT]
>
> This method can only be used if `requestSaving.enabled` is `true` when creating the interceptor. See
> [Saving intercepted requests](#saving-requests) for more information.

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
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'new' }),
});

expect(updateHandler.requests).toHaveLength(1);
expect(updateHandler.requests[0].pathParams).toEqual({ id: '1' });
expect(updateHandler.requests[0].body).toEqual({ username: 'new' });
expect(updateHandler.requests[0].response.status).toBe(200);
expect(updateHandler.requests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td><td width="900px" valign="top"><details open><summary><b>Using a remote interceptor</b></summary>

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
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'new' }),
});

expect(updateHandler.requests).toHaveLength(1);
expect(updateHandler.requests[0].pathParams).toEqual({ id: '1' });
expect(updateHandler.requests[0].body).toEqual({ username: 'new' });
expect(updateHandler.requests[0].response.status).toBe(200);
expect(updateHandler.requests[0].response.body).toEqual([{ username: 'new' }]);
```

</details></td></tr></table>

## Intercepted HTTP resources

The intercepted requests and responses are typed based on their
[interceptor schema](api‐zimic‐interceptor‐http‐schemas). They are available as simplified objects based on the
[`Request`](https://developer.mozilla.org/docs/Web/API/Request) and
[`Response`](https://developer.mozilla.org/docs/Web/API/Response) web APIs. `body` contains the parsed body, while typed
headers, path params and search params are in `headers`, `pathParams`, and `searchParams`, respectively.

The body is automatically parsed based on the header `content-type` of the request or response. The following table
shows how each type is parsed, where `*` indicates any other resource that does not match the previous types:

| `content-type`                      | Parsed to                                             |
| ----------------------------------- | ----------------------------------------------------- |
| `application/json`                  | `JSON`                                                |
| `application/xml`                   | `String`                                              |
| `application/x-www-form-urlencoded` | [`HttpSearchParams`](api‐zimic‐http#httpsearchparams) |
| `application/*` (others)            | `Blob`                                                |
| `multipart/form-data`               | [`HttpFormData`](api‐zimic‐http#httpformdata)         |
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

## Guides

- [Testing](guides‐testing‐interceptor)
