import { InterceptorServer, interceptorServer } from '@/interceptor/server';
import { InterceptorServerOptions } from '@/interceptor/server/types/options';
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
  onReady?: {
    command: string;
    arguments: string[];
  };
}

export let serverSingleton: InterceptorServer | undefined;

async function startInterceptorServer({
  hostname,
  port,
  ephemeral,
  logUnhandledRequests,
  onReady,
}: InterceptorServerStartOptions) {
  const server = interceptorServer.create({
    hostname,
    port,
    logUnhandledRequests,
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

  logWithPrefix(`${ephemeral ? 'Ephemeral s' : 'S'}erver is running on ${server.httpURL()}`);

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
