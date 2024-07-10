import { runCommand as internalRunCommand, CommandError as InternalCommandError } from '@/utils/processes';

/**
 * Runs a command with the given arguments.
 *
 * @deprecated Runnings commands is not specific to interceptor servers and not a focus of Zimic. Because of that, this
 *   utility will be removed in v0.9. As alternatives, use the native Node.js
 *   {@link https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback `child_process.exec`} or
 *   {@link https://nodejs.org/api/child_process.html#child_processspawncommand-args-options `child_process.spawn`}
 *   directly, or a library such as {@link https://www.npmjs.com/package/execa `execa`} or
 *   {@link https://www.npmjs.com/package/cross-spawn `cross-spawn`}.
 * @param command The command to run.
 * @param commandArguments The arguments to pass to the command.
 * @param options The options to pass to the spawn function. By default, stdio is set to 'inherit'.
 * @throws {CommandError} When the command exits with a non-zero code.
 */
export const runCommand = internalRunCommand;

/**
 * An error thrown when a command exits with a non-zero code.
 *
 * @deprecated Runnings commands is not specific to interceptor servers and not a focus of Zimic. Following the
 *   deprecation of {@link runCommand}, this error will be removed in v0.9.
 */
export const CommandError = InternalCommandError;
