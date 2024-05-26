import { SpawnOptions } from 'child_process';
import { spawn } from 'cross-spawn';

export const PROCESS_EXIT_EVENTS = Object.freeze([
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const);

/** An error thrown when a command exits with a non-zero code. */
export class CommandError extends Error {
  constructor(command: string, exitCode: number | null, signal: NodeJS.Signals | null) {
    super(`Command '${command}' exited ${exitCode === null ? `after signal ${signal}` : `with code ${exitCode}`}.`);
    this.name = 'CommandError';
  }
}

/**
 * Runs a command with the given arguments.
 *
 * @param command The command to run.
 * @param commandArguments The arguments to pass to the command.
 * @param options The options to pass to the spawn function. By default, stdio is set to 'inherit'.
 * @throws {CommandError} When the command exits with a non-zero code.
 */
export async function runCommand(command: string, commandArguments: string[], options: SpawnOptions = {}) {
  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, commandArguments, {
      stdio: 'inherit',
      ...options,
    });

    childProcess.once('error', (error) => {
      childProcess.removeAllListeners();
      reject(error);
    });

    childProcess.once('exit', (exitCode, signal) => {
      childProcess.removeAllListeners();

      if (exitCode === 0) {
        resolve();
        return;
      }

      const failureError = new CommandError(command, exitCode, signal);
      reject(failureError);
    });
  });
}
