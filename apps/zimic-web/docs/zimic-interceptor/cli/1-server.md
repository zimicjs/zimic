---
title: zimic-interceptor server | @zimic/interceptor
sidebar_label: zimic-interceptor server
slug: /interceptor/cli/server
---

# `zimic-interceptor server`

`zimic-interceptor server` contains commands to manage [interceptor servers](/docs/zimic-interceptor/api/5-interceptor-server.md).

```
zimic-interceptor server

Commands:
  zimic-interceptor server start [--onReady]   Start an interceptor server.
  zimic-interceptor server token               Manage remote interceptor
                                               authentication tokens.
```

**Related**:

- [Using remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md)
- [`InterceptorServer` API reference](/docs/zimic-interceptor/api/5-interceptor-server.md)

## `zimic-interceptor server start`

Start an interceptor server.

```
zimic-interceptor server start [-- onReady]

Positionals:
  onReady  A command to run when the server is ready to accept connections.
                                                                        [string]

Options:
  -h, --hostname                The hostname to start the server on.
                                                 [string] [default: "localhost"]
  -p, --port                    The port to start the server on.        [number]
  -e, --ephemeral               Whether the server should stop automatically
                                after the on-ready command finishes. If no
                                on-ready command is provided and ephemeral is
                                true, the server will stop immediately after
                                starting.             [boolean] [default: false]
  -l, --log-unhandled-requests  Whether to log a warning when no interceptors
                                were found for the base URL of a request. If an
                                interceptor was matched, the logging behavior
                                for that base URL is configured in the
                                interceptor itself.                    [boolean]
  -t, --tokens-dir              The directory where the authorized interceptor
                                authentication tokens are saved. If provided,
                                only remote interceptors bearing a valid token
                                will be accepted. While authentication is
                                optional for private development servers, it is
                                strongly recommended when the server is not
                                bound to localhost, 127.0.0.1, or ::1, or when
                                it is shared over a network.            [string]
```

:::info NOTE: <span>Interceptor servers in development and testing</span>

Interceptor servers are development and test tools. Do not use them as production application servers.

:::

:::info IMPORTANT: <span>Interceptor server authentication</span>

Although `--tokens-dir` is optional for private development servers, we strongly recommend setting `--tokens-dir` when the server is not bound to `localhost`, `127.0.0.1`, or `::1`, or when it is shared over a network. Authentication prevents unauthorized remote interceptors from connecting to the server. Use [`server token create`](#zimic-interceptor-server-token-create) to protect your interceptor server with a token, then configure each remote interceptor with [`auth.token`](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication).

Without `--tokens-dir`, browser remote interceptors can connect only when both the server and the web application use a loopback hostname. Starting an unauthenticated server logs a warning when it uses a non-loopback hostname or runs with `NODE_ENV=production`. See [interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication) for details.

In `@zimic/interceptor` v2, an unauthenticated server will refuse to start on a non-loopback hostname.

:::

## `zimic-interceptor server token`

Manage remote interceptor authentication tokens.

```
zimic-interceptor server token

Commands:
  zimic-interceptor server token create         Create an interceptor token.
  zimic-interceptor server token ls             List the authorized interceptor tokens.
                                                                         [aliases: list]
  zimic-interceptor server token rm <tokenId>   Remove an interceptor token.
                                                                       [aliases: remove]
```

**Related**:

- [Interceptor server authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication)

### `zimic-interceptor server token create`

Create an interceptor token.

```
zimic-interceptor server token create

Options:
  -n, --name        The name of the token to create.                    [string]
  -t, --tokens-dir  The directory where the created interceptor token will be
                    saved.[string] [default: ".zimic/interceptor/server/tokens"]
```

### `zimic-interceptor server token ls`

List the authorized interceptor tokens.

```
zimic-interceptor server token ls

Options:
  -t, --tokens-dir  The directory where the interceptor tokens are saved.
                          [string] [default: ".zimic/interceptor/server/tokens"]
```

### `zimic-interceptor server token rm`

Remove (invalidate) an interceptor token. Existing connections will not be affected, so restarting the server is recommended to disconnect all interceptors.

```
zimic-interceptor server token rm <tokenId>

Positionals:
  tokenId  The identifier of the token to remove.            [string] [required]

Options:
  -t, --tokens-dir  The directory where the interceptor tokens are saved.
                          [string] [default: ".zimic/interceptor/server/tokens"]
```
