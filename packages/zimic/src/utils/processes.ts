import { execa as $, ExecaError } from 'execa';

export const PROCESS_EXIT_EVENTS = Object.freeze([
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const);

export class CommandError extends Error {
  constructor(
    command: string,
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    originalMessage?: string | null,
  ) {
    const message =
      exitCode !== null || signal !== null
        ? `Command '${command}' exited ${exitCode === null ? `after signal ${signal}` : `with code ${exitCode}`}`
        : `Command '${command}' failed: ${originalMessage}`;

    super(message);

    this.name = 'CommandError';
  }
}

export async function runCommand(command: string, commandArguments: string[]) {
  try {
    await $({
      stdio: 'inherit',
    })(command, commandArguments);
  } catch (error) {
    if (!(error instanceof ExecaError)) {
      throw error;
    }

    const commandError = new CommandError(command, error.exitCode ?? null, error.signal ?? null, error.originalMessage);
    throw commandError;
  }
}
