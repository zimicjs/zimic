---
title: InterceptorServer | @zimic/interceptor
sidebar_label: InterceptorServer
slug: /interceptor/api/interceptor-server
---

# `InterceptorServer`

An interceptor server can be used to handle requests and return mock responses in combination with [remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md), which declare the responses the server should return for a given request. Interceptor servers and remote interceptors communicate with [remote-procedure calls](https://en.wikipedia.org/wiki/Remote_procedure_call) (RPC) over [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSockets_API).

:::info NOTE: <span>Interceptor servers in development and testing</span>

Interceptor servers are development and test tools. Do not use them as production application servers.

:::

**Related**:

- [Using remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md)
- [`zimic-interceptor server` CLI reference](/docs/zimic-interceptor/cli/1-server.md)

## `server.hostname`

The hostname of the server. It can be reassigned to a new value if the server is not running.

**Type**: `string`

## `server.port`

The port of the server. It can be reassigned to a new value if the server is not running. If not provided, it will be `undefined` until the server is started, at which point the server will use a random available port and this property will be updated accordingly.

**Type**: `number | undefined`

## `server.logUnhandledRequests`

Whether to log warnings about unhandled requests to the console. It can be reassigned to a new value.

**Type**: `boolean` (default: `true`)

## `server.tokensDirectory`

The directory where the authorized interceptor authentication tokens are saved.

While this property is optional for private development servers, we recommend setting a tokens directory when the server is not bound to `localhost`, `127.0.0.1`, or `::1`, or when it is shared over a network. Every remote interceptor must then provide a valid token through [`auth.token`](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx), which prevents unauthorized interceptors from connecting to the server.

Without a tokens directory, browser remote interceptors can connect only when both the server and the web application use a loopback hostname. Starting an unauthenticated server logs a warning when it uses a non-loopback hostname or runs with `NODE_ENV=production`. See [interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication) for details.

In `@zimic/interceptor` v2, an unauthenticated server will refuse to start on a non-loopback hostname.

**Type**: `string | undefined`

**Related**:

- [Interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication)

## `server.isRunning`

Whether the server is running.

**Type**: `boolean` (readonly)

## `server.start()`

Starts the server. It will automatically stop if a process exit event is detected, such as SIGINT, SIGTERM, or an uncaught exception.

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
