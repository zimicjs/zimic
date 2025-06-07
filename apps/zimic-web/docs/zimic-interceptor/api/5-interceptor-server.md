title: InterceptorServer | @zimic/interceptor sidebar_label: InterceptorServer slug: /interceptor/api/interceptor-server

# `InterceptorServer`

A server to intercept and handle requests. It is used in combination with
[remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md).

**Related**:

- [Using remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md)
- [`zimic-interceptor server` CLI reference](/docs/zimic-interceptor/cli/1-server.md)

## `server.hostname`

The hostname of the server. It can be reassigned to a new value if the server is not running.

```ts
server.hostname;
```

**Type**: `string`

## `server.port`

The port of the server. It can be reassigned to a new value if the server is not running.

```ts
server.port;
```

**Type**: `number | undefined`

## `server.logUnhandledRequests`

Whether to log warnings about unhandled requests to the console. It can be reassigned to a new value.

```ts
server.logUnhandledRequests;
```

**Type**: `boolean` (default: `true`)

## `server.tokensDirectory`

The directory where the authorized interceptor authentication tokens are saved. If provided, only remote interceptors
bearing a valid token will be accepted. This option is essential if you are exposing your interceptor server publicly.
For local development and testing, though, a tokens directory is optional.

```ts
server.tokensDirectory;
```

**Type**: `string | undefined`

**Related**:

- [Interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication)

## `server.isRunning`

Whether the server is running.

```ts
server.isRunning;
```

**Type**: `boolean` (readonly)

## `server.start()`

Starts the server. It will automatically stop if a process exit event is detected, such as SIGINT, SIGTERM, or an
uncaught exception.

```ts
await server.start();
```

**Returns**: `Promise<void>`

## `server.stop()`

Stops the server.

```ts
await server.stop();
```

**Returns**: `Promise<void>`
