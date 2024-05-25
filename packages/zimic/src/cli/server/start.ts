import { logWithPrefix } from '@/utils/console';
import { runCommand, PROCESS_EXIT_EVENTS } from '@/utils/processes';

import InterceptorServer, { InterceptorServerOptions } from '../../interceptor/server/InterceptorServer';

interface InterceptorServerStartOptions extends InterceptorServerOptions {
  ephemeral: boolean;
  onReady?: {
    command: string;
    arguments: string[];
  };
}

export let singletonServer: InterceptorServer | undefined;

async function startInterceptorServer({
  hostname,
  port,
  ephemeral,
  onUnhandledRequest,
  onReady,
}: InterceptorServerStartOptions) {
  const server = new InterceptorServer({
    hostname,
    port,
    onUnhandledRequest,
  });

  singletonServer = server;

  for (const exitEvent of PROCESS_EXIT_EVENTS) {
    process.on(exitEvent, async () => {
      await server.stop();
    });
  }

  await server.start();

  logWithPrefix(`${ephemeral ? 'Ephemeral s' : 'S'}erver is running on '${server.httpURL()}'.`);

  if (onReady) {
    await runCommand(onReady.command, onReady.arguments);
  }

  if (ephemeral) {
    await server.stop();
  }

  for (const exitEvent of PROCESS_EXIT_EVENTS) {
    process.removeAllListeners(exitEvent);
  }
}

export default startInterceptorServer;
