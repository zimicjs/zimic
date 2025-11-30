import { spawn, SpawnOptions } from 'child_process';

import { PROCESS_EXIT_CODE_BY_EXIT_EVENT } from './constants';

interface CommandErrorOptions {
  command?: string[];
  exitCode?: number;
  signal?: NodeJS.Signals;
  cause?: Error;
}

export class CommandError extends Error {
  static readonly DEFAULT_EXIT_CODE = 1;

  readonly command: string[];
  readonly exitCode: number;
  readonly signal?: NodeJS.Signals;
  readonly cause?: Error;

  constructor(executable: string, options: CommandErrorOptions) {
    const message = CommandError.createMessage(executable, options);
    super(message);

    this.name = 'CommandError';
    this.command = options.command ?? [executable];
    this.exitCode = this.getExitCode(options);
    this.signal = options.signal;
    this.cause = options.cause;
  }

  private getExitCode(options: CommandErrorOptions): number {
    const existingExitCode = options.exitCode;

    const exitCodeInferredFromSignal =
      options.signal === undefined ? undefined : PROCESS_EXIT_CODE_BY_EXIT_EVENT[options.signal];

    return existingExitCode ?? exitCodeInferredFromSignal ?? CommandError.DEFAULT_EXIT_CODE;
  }

  private static createMessage(command: string, options: CommandErrorOptions) {
    const originalMessage = options.cause?.message;
    const suffix = originalMessage ? `: ${originalMessage}` : '';

    if (options.exitCode === undefined && options.signal === undefined) {
      return `Command '${command}' failed${suffix}`;
    }

    const prefix = `Command '${command}' exited `;
    const infix = options.exitCode === undefined ? `after signal ${options.signal}` : `with code ${options.exitCode}`;

    return `${prefix}${infix}${suffix}`;
  }
}

async function runCommand(commandEntry: string, commandArguments: string[], options: SpawnOptions = {}) {
  await new Promise<void>((resolve, reject) => {
    const commandProcess = spawn(commandEntry, commandArguments, { stdio: 'inherit', ...options });

    commandProcess.once('error', (error) => {
      const commandError = new CommandError(commandEntry, {
        command: [commandEntry, ...commandArguments],
        cause: error,
      });
      reject(commandError);
    });

    commandProcess.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const commandError = new CommandError(commandEntry, {
        command: [commandEntry, ...commandArguments],
        exitCode: code ?? undefined,
        signal: signal ?? undefined,
      });
      reject(commandError);
    });
  });
}

export default runCommand;
