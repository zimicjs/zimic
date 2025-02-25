# CLI: `zimic-interceptor server` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic-interceptor server start`](#zimic-interceptor-server-start)
- [Programmatic usage](#programmatic-usage)

---

This module contains commands to manage interceptor servers.

An interceptor server is a standalone server that can be used to handle requests and return mock responses. It is used
in combination with [remote interceptors](getting‐started#remote-http-interceptors), which declare which responses the
server should return for a given request. Interceptor servers and remote interceptors communicate with
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

## Programmatic usage

See the [`zimic/interceptor/server` API reference](api‐zimic‐interceptor‐server).
