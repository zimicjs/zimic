import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';
import { createInterceptorServerToken, DEFAULT_INTERCEPTOR_SERVER_TOKEN_LENGTH } from './server/token/create';

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
                .option('config', {
                  type: 'string',
                  description: 'The path to the Zimic configuration directory to use.',
                  alias: 'c',
                  default: '.zimic',
                })
                .option('length', {
                  type: 'number',
                  description: 'The length of the token to create.',
                  alias: 'l',
                  default: DEFAULT_INTERCEPTOR_SERVER_TOKEN_LENGTH,
                }),
            async (cliArguments) => {
              await createInterceptorServerToken({
                configDirectory: cliArguments.config,
                tokenLength: cliArguments.length,
              });
            },
          ),
        ),
    )

    .parse();
}

export default runCLI;
