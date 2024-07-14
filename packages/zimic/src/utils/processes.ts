export const PROCESS_EXIT_EVENTS = Object.freeze([
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const);

export type ProcessExitEvent = (typeof PROCESS_EXIT_EVENTS)[number];

// Having an undefined exit code means that the process will already exit with the default exit code.
export const PROCESS_EXIT_CODE_BY_EXIT_EVENT: Record<string, number | undefined> = {
  beforeExit: undefined,
  uncaughtExceptionMonitor: undefined,
  SIGINT: 130,
  SIGTERM: 143,
  SIGHUP: 129,
  SIGBREAK: 131,
} satisfies Record<ProcessExitEvent, number | undefined>;

let execaSingleton: typeof import('execa') | undefined;

async function importExeca() {
  if (!execaSingleton) {
    execaSingleton = await import('execa');
  }
  return execaSingleton;
}

interface CommandErrorOptions {
  command?: string[];
  exitCode?: number;
  signal?: NodeJS.Signals;
  originalMessage?: string;
}

export class CommandError extends Error {
  static readonly DEFAULT_EXIT_CODE = 1;

  readonly command: string[];
  readonly exitCode: number;
  readonly signal?: NodeJS.Signals;

  constructor(executable: string, options: CommandErrorOptions) {
    const message = CommandError.createMessage(executable, options);
    super(message);

    this.name = 'CommandError';
    this.command = options.command ?? [executable];
    this.exitCode = this.getExitCode(options);
    this.signal = options.signal;
  }

  private getExitCode(options: CommandErrorOptions): number {
    const existingExitCode = options.exitCode;
    const exitCodeInferredFromSignal =
      options.signal === undefined ? undefined : PROCESS_EXIT_CODE_BY_EXIT_EVENT[options.signal];

    return existingExitCode ?? exitCodeInferredFromSignal ?? CommandError.DEFAULT_EXIT_CODE;
  }

  private static createMessage(command: string, options: CommandErrorOptions) {
    const suffix = options.originalMessage ? `: ${options.originalMessage}` : '';

    if (options.exitCode === undefined && options.signal === undefined) {
      return `Command '${command}' failed${suffix}`;
    }

    const prefix = `Command '${command}' exited `;
    const infix = options.exitCode === undefined ? `after signal ${options.signal}` : `with code ${options.exitCode}`;

    return `${prefix}${infix}${suffix}`;
  }
}

export async function runCommand(command: string, commandArguments: string[]) {
  const { execa: $, ExecaError } = await importExeca();

  try {
    await $(command, commandArguments, { stdio: 'inherit' });
  } catch (error) {
    /* istanbul ignore if -- @preserve
     * This is a safeguard if the error is not an ExecaError. It is not expected to run. */
    if (!(error instanceof ExecaError)) {
      throw error;
    }

    const commandError = new CommandError(command, {
      command: [command, ...commandArguments],
      exitCode: error.exitCode,
      signal: error.signal,
      originalMessage: error.originalMessage,
    });

    throw commandError;
  }
}
