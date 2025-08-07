---
title: createInterceptorServer | @zimic/interceptor
sidebar_label: createInterceptorServer
slug: /interceptor/api/create-interceptor-server
---

# `createInterceptorServer`

Creates an [interceptor server](/docs/zimic-interceptor/api/5-interceptor-server.md). This function is an alternative to
the [`zimic-interceptor server` CLI command](/docs/zimic-interceptor/cli/1-server.md) and can be used to
programmatically manage an interceptor server in your code. We recommend using the CLI command for most use cases, but
`createInterceptorServer` is useful for more advanced scenarios.

```ts
createInterceptorServer(options);
```

**Arguments**:

1. **options**: `InterceptorServerOptions`

   The options to create an [interceptor server](/docs/zimic-interceptor/cli/1-server.md).
   - **hostname**: `string | undefined` (default: `'localhost'`)

     The hostname to start the server on.

   - **port**: `number | undefined`

     The port to start the server on. If no port is provided, a random one is chosen.

   - **logUnhandledRequests**: `boolean | undefined` (default: `true`)

     Whether to log warnings about unhandled requests to the console.

   - **tokensDirectory**: `string | undefined` (default: `undefined`)

     The directory where the authorized interceptor authentication tokens are saved. If provided, only remote
     interceptors bearing a valid token will be accepted. This option is essential if you are exposing your interceptor
     server publicly. For local development and testing, though, `--tokens-dir` is optional.

**Returns**: `InterceptorServer`

An [interceptor server](/docs/zimic-interceptor/api/5-interceptor-server.md) which can be used to connect
[remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md).

```ts
import { spawn, SpawnOptions } from 'child_process';
import { createInterceptorServer } from '@zimic/interceptor/server';

function runCommand(commandEntry: string, commandArguments: string[], options: SpawnOptions) {
  return new Promise<void>((resolve, reject) => {
    const commandProcess = spawn(commandEntry, commandArguments, options);

    commandProcess.once('error', (error) => {
      reject(error);
    });

    commandProcess.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command '${commandEntry}' exited with code ${code}`));
      }
    });
  });
}

// highlight-start
const server = createInterceptorServer({
  hostname: 'localhost',
  port: 3000,
});
// highlight-end

await server.start();

// Run a command when the server is ready, assuming the following format:
// node <script> -- <command> [...commandArguments]
const [commandEntry, ...commandArguments] = process.argv.slice(3);
await runCommand(commandEntry, commandArguments, { stdio: 'inherit' });

await server.stop();
process.exit(0);
```

**Related**:

- [Using remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md)
- [`zimic-interceptor server` CLI reference](/docs/zimic-interceptor/cli/1-server.md)
- [`InterceptorServer` API reference](/docs/zimic-interceptor/api/5-interceptor-server.md)
