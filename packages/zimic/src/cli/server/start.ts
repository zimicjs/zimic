import { createInterceptorServer } from '@/interceptor/server';
import { InterceptorServerOptions } from '@/interceptor/server/types/options';
import { InterceptorServer } from '@/interceptor/server/types/public';
import { logWithPrefix } from '@/utils/console';
import { runCommand } from '@/utils/processes';

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
  const server = createInterceptorServer({
    hostname,
    port,
    onUnhandledRequest,
  });

  singletonServer = server;

  await server.start();

  logWithPrefix(`${ephemeral ? 'Ephemeral s' : 'S'}erver is running on ${server.httpURL()}`);

  if (onReady) {
    await runCommand(onReady.command, onReady.arguments);
  }

  if (ephemeral) {
    await server.stop();
  }
}

export default startInterceptorServer;
