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

export class CommandError extends Error {
  constructor(command: string, exitCode: number | null, signal: NodeJS.Signals | null) {
    super(`Command '${command}' exited ${exitCode === null ? `after signal ${signal}` : `with code ${exitCode}`}.`);
    this.name = 'CommandError';
  }
}

export async function runCommand(command: string, commandArguments: string[], options: SpawnOptions) {
  await new Promise<void>((resolve, reject) => {
    const { stdio = 'inherit', ...otherOptions } = options;

    const childProcess = spawn(command, commandArguments, { stdio, ...otherOptions });

    childProcess.once('error', (error) => {
      childProcess.removeAllListeners();
      reject(error);
    });

    childProcess.once('exit', (exitCode, signal) => {
      childProcess.removeAllListeners();

      if (exitCode === 0) {
        resolve();
      } else {
        const failureError = new CommandError(command, exitCode, signal);
        reject(failureError);
      }
    });
  });
}
