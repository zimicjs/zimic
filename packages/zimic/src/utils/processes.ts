export const PROCESS_EXIT_EVENTS = Object.freeze([
  'beforeExit',
  'uncaughtExceptionMonitor',
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
] as const);

let execaSingleton: typeof import('execa') | undefined;

async function importExeca() {
  if (!execaSingleton) {
    execaSingleton = await import('execa');
  }
  return execaSingleton;
}

interface CommandErrorOptions {
  exitCode?: number;
  signal?: NodeJS.Signals;
  originalMessage?: string;
}

export class CommandError extends Error {
  constructor(command: string, options: CommandErrorOptions) {
    const message = CommandError.createMessage(command, options);
    super(message);

    this.name = 'CommandError';
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
    await $({
      stdio: 'inherit',
    })(command, commandArguments);
  } catch (error) {
    /* istanbul ignore if -- @preserve
     * This is a safeguard if the error is not an ExecaError. It is not expected to run. */
    if (!(error instanceof ExecaError)) {
      throw error;
    }

    const commandError = new CommandError(command, {
      exitCode: error.exitCode,
      signal: error.signal,
      originalMessage: error.originalMessage,
    });

    throw commandError;
  }
}
