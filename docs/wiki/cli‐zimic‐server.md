# `zimic-interceptor server` - CLI <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic-interceptor server start`](#zimic-interceptor-server-start)
- [Programmatic usage](#programmatic-usage)

---

`zimic-interceptor server` contains commands to manage interceptor servers.

```
zimic-interceptor server

Manage interceptor servers.

Commands:
  zimic-interceptor server start [--onReady]   Start an interceptor server.
  zimic-interceptor server token               Manage remote interceptor
                                               authentication tokens.
```

An interceptor server is a standalone server that can be used to handle requests and return mock responses. It is used
in combination with [remote interceptors](getting‐started‐interceptor#remote-http-interceptors), which declare which
responses the server should return for a given request. Interceptor servers and remote interceptors communicate with
[remote-procedure calls](https://en.wikipedia.org/wiki/Remote_procedure_call) (RPC) over
[WebSocket](https://developer.mozilla.org/docs/Web/API/WebSockets_API).

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

You can use this command to start an independent server:

```bash
zimic-interceptor server start --port 4000
```

Or as a prefix of another command:

```bash
zimic-interceptor server start --port 4000 --ephemeral -- npm run test
```

The command after `--` will be executed when the server is ready. The flag `--ephemeral` indicates that the server
should automatically stop after the command finishes.

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

### `zimic-interceptor server token ls`

Remove an interceptor token.

```
zimic-interceptor server token rm <tokenId>

Positionals:
  tokenId  The identifier of the token to remove.            [string] [required]

Options:
  -t, --tokens-dir  The directory where the interceptor tokens are saved.
                          [string] [default: ".zimic/interceptor/server/tokens"]
```

## Programmatic usage

See the [`zimic/interceptor/server` API reference](api‐zimic‐interceptor‐server).
