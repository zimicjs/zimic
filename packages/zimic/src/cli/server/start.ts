import { logWithPrefix } from '@/cli/utils/console';
import { runCommand, PROCESS_EXIT_EVENTS } from '@/utils/processes';

import Server from '../../server/Server';

interface ServerStartOptions {
  hostname: string;
  port?: number;
  ephemeral: boolean;
  onReady?: {
    command: string;
    arguments: string[];
  };
}

export let singletonServer: Server | undefined;

async function startServer({ hostname, port, ephemeral, onReady }: ServerStartOptions) {
  const server = new Server({ hostname, port });
  singletonServer = server;

  for (const exitEvent of PROCESS_EXIT_EVENTS) {
    process.on(exitEvent, async () => {
      await server.stop();
    });
  }

  await server.start();

  await logWithPrefix(`${ephemeral ? 'Ephemeral s' : 'S'}erver is running on '${server.url()}'.`);

  if (onReady) {
    await runCommand(onReady.command, onReady.arguments);
  }

  if (ephemeral) {
    await server.stop();
  }
}

export default startServer;
