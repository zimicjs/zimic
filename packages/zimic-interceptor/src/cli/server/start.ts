import color from 'picocolors';

import { InterceptorServer, createInterceptorServer } from '@/server';
import { InterceptorServerOptions } from '@/server/types/options';
import { logWithPrefix } from '@/utils/console';
import {
  CommandError,
  PROCESS_EXIT_CODE_BY_EXIT_EVENT,
  PROCESS_EXIT_EVENTS,
  ProcessExitEvent,
  runCommand,
} from '@/utils/processes';

interface InterceptorServerStartOptions extends InterceptorServerOptions {
  ephemeral: boolean;
  onReady?: { command: string; arguments: string[] };
}

export let serverSingleton: InterceptorServer | undefined;

async function startInterceptorServer({
  hostname,
  port,
  logUnhandledRequests,
  tokensDirectory,
  ephemeral,
  onReady,
}: InterceptorServerStartOptions) {
  const server = createInterceptorServer({
    hostname,
    port,
    logUnhandledRequests,
    tokensDirectory,
  });

  async function handleExitEvent(exitEvent: ProcessExitEvent | undefined) {
    await server.stop();

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    for (const { exitEvent, exitHandler } of exitHandlerGroups) {
      process.off(exitEvent, exitHandler);
    }

    const exitCode = exitEvent ? PROCESS_EXIT_CODE_BY_EXIT_EVENT[exitEvent] : undefined;
    if (exitCode !== undefined) {
      process.exit(exitCode);
    }
  }

  const exitHandlerGroups = PROCESS_EXIT_EVENTS.map((exitEvent) => ({
    exitEvent,
    exitHandler: handleExitEvent.bind(null, exitEvent),
  }));

  for (const { exitEvent, exitHandler } of exitHandlerGroups) {
    process.on(exitEvent, exitHandler);
  }

  serverSingleton = server;

  await server.start();

  logWithPrefix(
    `${ephemeral ? 'Ephemeral s' : 'S'}erver is running on ${color.yellow(`${server.hostname}:${server.port}`)}`,
  );

  const isDangerouslyUnprotected = !tokensDirectory && process.env.NODE_ENV === 'production';

  if (isDangerouslyUnprotected) {
    logWithPrefix(
      [
        `Attention: this server is ${color.red('unprotected')}. Do not expose it publicly without authentication.`,
        '',
        'Learn more: https://github.com/zimicjs/zimic/wiki/cli‐zimic‐interceptor‐server#authentication',
      ].join('\n'),
      { method: 'warn' },
    );
  }

  if (onReady) {
    try {
      await runCommand(onReady.command, onReady.arguments);
    } catch (error) {
      console.error(error);

      /* istanbul ignore if -- @preserve
       * A CommandError is always expected here. */
      if (!(error instanceof CommandError)) {
        throw error;
      }

      process.exit(error.exitCode);
    }
  }

  if (ephemeral) {
    await handleExitEvent(undefined);
    process.exit(0);
  }
}

export default startInterceptorServer;
