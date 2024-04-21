import { spawn } from 'child_process';

import Server from './Server';

async function runCommand(
  command: string,
  options: {
    shell?: boolean | string;
  },
) {
  await new Promise<void>((resolve, reject) => {
    const onReadyProcess = spawn(command, {
      shell: options.shell,
      stdio: 'inherit',
    });

    onReadyProcess.once('exit', (code) => {
      onReadyProcess.removeAllListeners();

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`The command '${command}' exited with code ${code}.`));
      }
    });

    onReadyProcess.once('error', (error) => {
      onReadyProcess.removeAllListeners();
      reject(error);
    });
  });
}

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
  onReady?: string;
  onReadyShell?: string;
  ephemeral: boolean;
}

async function startServer({
  hostname,
  port,
  onReady: onReadyCommand,
  onReadyShell: onReadyCommandShell,
  ephemeral,
}: ServerStartOptions) {
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
