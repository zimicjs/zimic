import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import { DEFAULT_INTERCEPTOR_TOKEN_SECRET_LENGTH } from '../server/utils/auth';
import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';
import { createInterceptorServerToken } from './server/token/create';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic-interceptor')
    .version(version)
    .showHelpOnFail(false)
    .strict()

    .command('browser', 'Manage your browser mock configuration', (yargs) =>
      yargs.demandCommand().command(
        'init <publicDirectory>',
        'Initialize the browser service worker configuration',
        (yargs) =>
          yargs.positional('publicDirectory', {
            type: 'string',
            description: 'The path to the public directory of your application.',
            demandOption: true,
          }),
        async (cliArguments) => {
          await initializeBrowserServiceWorker({
            publicDirectory: cliArguments.publicDirectory,
          });
        },
      ),
    )

    .command('server', 'Manage interceptor servers', (yargs) =>
      yargs
        .demandCommand()
        .command(
          'start [-- onReady]',
          'Start an interceptor server',
          (yargs) =>
            yargs
              .positional('onReady', {
                description: 'A command to run when the server is ready to accept connections.',
                type: 'string',
              })
              .option('hostname', {
                type: 'string',
                description: 'The hostname to start the server on.',
                alias: 'h',
                default: 'localhost',
              })
              .option('port', {
                type: 'number',
                description: 'The port to start the server on.',
                alias: 'p',
              })
              .option('ephemeral', {
                type: 'boolean',
                description:
                  'Whether the server should stop automatically after the on-ready command finishes. ' +
                  'If no on-ready command is provided and ephemeral is true, the server will stop immediately after ' +
                  'starting.',
                alias: 'e',
                default: false,
              })
              .option('log-unhandled-requests', {
                type: 'boolean',
                description:
                  'Whether to log a warning when no interceptors were found for the base URL of a request. ' +
                  'If an interceptor was matched, the logging behavior for that base URL is configured in the ' +
                  'interceptor itself.',
                alias: 'l',
              })
              .option('tokens-dir', {
                type: 'string',
                description:
                  'The path to the directory where the authentication tokens for remote interceptors are stored. ' +
                  'If not provided, only remote interceptors with one of the allowed tokens will be accepted. This ' +
                  'option is strongly recommended if you are exposing your interceptor server publicly.',
                alias: 't',
              }),
          async (cliArguments) => {
            const onReadyCommand = cliArguments._.at(2)?.toString();
            const onReadyCommandArguments = cliArguments._.slice(3).map((argument) => argument.toString());

            await startInterceptorServer({
              hostname: cliArguments.hostname,
              port: cliArguments.port,
              ephemeral: cliArguments.ephemeral,
              logUnhandledRequests: cliArguments.logUnhandledRequests,
              onReady: onReadyCommand
                ? {
                    command: onReadyCommand.toString(),
                    arguments: onReadyCommandArguments,
                  }
                : undefined,
            });
          },
        )

        .command('token', 'Manage remote interceptor authentication tokens', (yargs) =>
          yargs.command(
            'create',
            'Create a token for remote interceptors to connect to this server',
            (yargs) =>
              yargs
                .option('secret-length', {
                  type: 'number',
                  description: 'The length of the token secret to create.',
                  alias: 'l',
                  default: DEFAULT_INTERCEPTOR_TOKEN_SECRET_LENGTH,
                })
                .option('tokens-dir', {
                  type: 'string',
                  description: 'The path to directory where the token hashes will be stored.',
                  alias: 't',
                  default: path.join('.zimic', 'interceptor', 'server', 'tokens'),
                }),
            async (cliArguments) => {
              await createInterceptorServerToken({
                tokensDirectory: cliArguments.tokensDir,
                secretLength: cliArguments.secretLength,
              });
            },
          ),
        ),
    )

    .parse();
}

export default runCLI;
