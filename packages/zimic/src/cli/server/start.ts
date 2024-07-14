import { InterceptorServer, interceptorServer } from '@/interceptor/server';
import { InterceptorServerOptions } from '@/interceptor/server/types/options';
import { logWithPrefix } from '@/utils/console';
import { runCommand } from '@/utils/processes';

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
  onUnhandledRequest,
  onReady,
}: InterceptorServerStartOptions) {
  const server = interceptorServer.create({
    hostname,
    port,
    onUnhandledRequest,
  });

  serverSingleton = server;

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
