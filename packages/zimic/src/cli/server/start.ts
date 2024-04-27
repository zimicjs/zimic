import { runCommand } from '@/utils/processes';

import Server from './Server';

const PROCESS_EXIT_EVENTS = [
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const;

interface ServerStartOptions {
  hostname: string;
  port?: number;
  ephemeral: boolean;
  onReady?: {
    command: string;
    arguments: string[];
  };
}

async function startServer({ hostname, port, ephemeral, onReady }: ServerStartOptions) {
  const server = new Server({ hostname, port });

  for (const exitEvent of PROCESS_EXIT_EVENTS) {
    process.on(exitEvent, async () => {
      await server.stop();
    });
  }

  await server.start();

  if (onReady) {
    await runCommand(onReady.command, onReady.arguments);
  }

  if (ephemeral) {
    await server.stop();
  }
}

export default startServer;
