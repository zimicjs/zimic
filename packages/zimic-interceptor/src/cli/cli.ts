import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '../server/utils/auth';
import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';
import { createInterceptorServerToken } from './server/token/create';
import { listInterceptorServerTokens } from './server/token/list';
import { removeInterceptorServerToken } from './server/token/remove';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic-interceptor')
    .version(version)
    .showHelpOnFail(false)
    .strict()

    .command('browser', 'Manage your browser mock configuration.', (yargs) =>
      yargs.demandCommand().command(
        'init <publicDirectory>',
        'Initialize the browser service worker configuration.',
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

    .command('server', 'Manage interceptor servers.', (yargs) =>
      yargs
        .demandCommand()
        .command(
          'start [-- onReady]',
          'Start an interceptor server.',
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
                  'The directory where the authorized interceptor authentication tokens are saved. If provided, only ' +
                  'remote interceptors bearing a valid token will be accepted. This option is essential if you are ' +
                  'exposing your interceptor server publicly. For local development and testing, though, ' +
                  '`--tokens-dir` is optional.',
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
              tokensDirectory: cliArguments.tokensDir,
              onReady: onReadyCommand
                ? {
                    command: onReadyCommand.toString(),
                    arguments: onReadyCommandArguments,
                  }
                : undefined,
            });
          },
        )

        .command('token', 'Manage remote interceptor authentication tokens.', (yargs) =>
          yargs
            .demandCommand()
            .command(
              'create',
              'Create an interceptor token.',
              (yargs) =>
                yargs
                  .option('name', {
                    type: 'string',
                    description: 'The name of the token to create.',
                    alias: 'n',
                  })
                  .option('tokens-dir', {
                    type: 'string',
                    description: 'The directory where the created interceptor token will be saved.',
                    alias: 't',
                    default: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
                  }),
              async (cliArguments) => {
                await createInterceptorServerToken({
                  tokenName: cliArguments.name,
                  tokensDirectory: cliArguments.tokensDir,
                });
              },
            )

            .command(
              ['ls', 'list'],
              'List the authorized interceptor tokens.',
              (yargs) =>
                yargs.option('tokens-dir', {
                  type: 'string',
                  description: 'The directory where the interceptor tokens are saved.',
                  alias: 't',
                  default: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
                }),
              async (cliArguments) => {
                await listInterceptorServerTokens({
                  tokensDirectory: cliArguments.tokensDir,
                });
              },
            )

            .command(
              ['rm <tokenId>', 'remove <tokenId>'],
              'Remove an interceptor token.',
              (yargs) =>
                yargs
                  .positional('tokenId', {
                    type: 'string',
                    description: 'The identifier of the token to remove.',
                    demandOption: true,
                  })
                  .option('tokens-dir', {
                    type: 'string',
                    description: 'The directory where the interceptor tokens are saved.',
                    alias: 't',
                    default: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
                  }),
              async (cliArguments) => {
                await removeInterceptorServerToken({
                  tokenId: cliArguments.tokenId,
                  tokensDirectory: cliArguments.tokensDir,
                });
              },
            ),
        ),
    )

    .parse();
}

export default runCLI;
