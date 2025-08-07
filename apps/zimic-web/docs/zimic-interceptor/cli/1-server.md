---
title: zimic-interceptor server | @zimic/interceptor
sidebar_label: zimic-interceptor server
slug: /interceptor/cli/server
---

# `zimic-interceptor server`

`zimic-interceptor server` contains commands to manage
[interceptor servers](/docs/zimic-interceptor/api/5-interceptor-server.md).

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
                                will be accepted. This option is essential if
                                you are exposing your interceptor server
                                publicly. For local development and testing,
                                though, `--tokens-dir` is optional.     [string]
```

:::info IMPORTANT: <span>Interceptor server authentication</span>

If you are exposing the server publicly, consider
[enabling authentication](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md#interceptor-server-authentication)
in the interceptor server.

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

Remove (invalidate) an interceptor token. Existing connections will not be affected, so restarting the server is
recommended to disconnect all interceptors.

```
zimic-interceptor server token rm <tokenId>

Positionals:
  tokenId  The identifier of the token to remove.            [string] [required]

Options:
  -t, --tokens-dir  The directory where the interceptor tokens are saved.
                          [string] [default: ".zimic/interceptor/server/tokens"]
```
