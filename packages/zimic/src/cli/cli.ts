import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from '@/interceptor/http/interceptorWorker/HttpInterceptorWorkerStore';

import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic')
    .version(version)
    .showHelpOnFail(false)
    .demandCommand()

    .command('browser', 'Browser', (yargs) =>
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
          await initializeBrowserServiceWorker(cliArguments);
        },
      ),
    )

    .command('server', 'Interceptor server', (yargs) =>
      yargs.demandCommand().command(
        'start [-- onReady]',
        'Start an interceptor server.',
        (yargs) =>
          yargs
            .positional('onReady', {
              description: 'A command to run when the server is ready to accept connections.',
              type: 'string',
              array: true,
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
              default: DEFAULT_UNHANDLED_REQUEST_STRATEGY.log,
            }),
        async (cliArguments) => {
          const onReadyCommand = cliArguments._.at(2)?.toString();
          const onReadyCommandArguments = cliArguments._.slice(3).map((argument) => argument.toString());

          await startInterceptorServer({
            hostname: cliArguments.hostname,
            port: cliArguments.port,
            ephemeral: cliArguments.ephemeral,
            onUnhandledRequest: {
              log: cliArguments.logUnhandledRequests,
            },
            onReady: onReadyCommand
              ? {
                  command: onReadyCommand.toString(),
                  arguments: onReadyCommandArguments,
                }
              : undefined,
          });
        },
      ),
    )

    .parse();
}

export default runCLI;
