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
  onReadyCommand?: string;
  onReadyCommandShell?: string;
  ephemeral: boolean;
}

async function startServer({ hostname, port, onReadyCommand, onReadyCommandShell, ephemeral }: ServerStartOptions) {
  const server = new Server({ hostname, port });

  for (const exitEvent of PROCESS_EXIT_EVENTS) {
    process.on(exitEvent, async () => {
      await server.stop();
    });
  }

  await server.start();

  if (onReadyCommand) {
    await runCommand(onReadyCommand, {
      shell: onReadyCommandShell ?? true,
    });
  }

  if (ephemeral) {
    await server.stop();
  }
}

export default startServer;
