# `zimic-interceptor server` - CLI <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic-interceptor server start`](#zimic-interceptor-server-start)
- [`zimic-interceptor server token`](#zimic-interceptor-server-token)
  - [`zimic-interceptor server token create`](#zimic-interceptor-server-token-create)
  - [`zimic-interceptor server token ls`](#zimic-interceptor-server-token-ls)
  - [`zimic-interceptor server token rm`](#zimic-interceptor-server-token-rm)
- [Authentication](#authentication)
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

> [!IMPORTANT]
>
> If you are exposing the server publicly, consider enabling authentication with the `--tokens-dir` option. See
> [Authentication](#authentication) for more details.

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

## Authentication

Interceptor servers can be configured to require interceptor authentication. This is **strongly recommended** if you are
exposing the server **publicly**. Without authentication, the server is unprotected and any interceptor can connect to
it and override the responses of any request.

To create an interceptor authentication token, use:

```bash
zimic-interceptor server token create --name <token-name>
```

Then, start the server using the `--tokens-dir` option, which points to the directory where the tokens are saved. The
server will only accept remote interceptors that have a valid token.

```bash
zimic-interceptor server start --port 4000 --tokens-dir .zimic/interceptor/server/tokens
```

You can list the authorized tokens with [`zimic-interceptor server token ls`](#zimic-interceptor-server-token-ls) and
remove (invalidate) them with [`zimic-interceptor server token rm`](#zimic-interceptor-server-token-rm).

> [!IMPORTANT]
>
> Make sure to keep the tokens directory private. Do not commit it to version control or expose it publicly. Even though
> the tokens are hashed in the directory, exposing it can lead to security issues.
>
> If you are running the server inside a container, make sure to persist the tokens directory in a volume. Otherwise,
> the tokens will be lost when the container is removed or recreated.

After the server is running, remote interceptors can connect to it passing the token in the `auth.token` option.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  type: 'remote',
  baseURL: 'http://localhost:3000',
  auth: { token: '<token>' },
});

await interceptor.start();
```

Replace `<token>` with the token you created earlier. Refer to
[remote interceptor authentication](api‐zimic‐interceptor‐http#remote-interceptor-authentication) for more information.

## Programmatic usage

See the [`zimic/interceptor/server` API reference](api‐zimic‐interceptor‐server).
