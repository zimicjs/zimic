import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';
import generateTypesFromOpenAPISchema, { readPathFiltersFromFile } from './typegen/openapi';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic')
    .version(version)
    .showHelpOnFail(false)
    .demandCommand()
    .strict()

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

    .command('typegen', 'Type generation', (yargs) =>
      yargs.demandCommand().command(
        'openapi <input>',
        'Generate service types from an OpenAPI schema.',
        (yargs) =>
          yargs
            .positional('input', {
              type: 'string',
              description: 'The path to a local OpenAPI schema file. YAML and JSON are supported.',
              demandOption: true,
            })
            .option('output', {
              type: 'string',
              description: 'The path to write the generated types to. If `-`, the output will be written to stdout.',
              alias: 'o',
              demandOption: true,
            })
            .option('service-name', {
              type: 'string',
              description: 'The name of the service to generate types for.',
              alias: 's',
              demandOption: true,
            })
            .option('remove-comments', {
              type: 'boolean',
              description: 'Whether to remove comments from the generated types.',
              default: false,
            })
            .option('prune-unused', {
              type: 'boolean',
              description:
                'Whether to remove unused operations and components from the generated types. This is useful for ' +
                'reducing the size of the output file.',
              default: true,
            })
            .option('filter', {
              type: 'string',
              array: true,
              description: 'One or more expressions to filter paths to generate types for.',
              default: [],
            })
            .option('filter-file', {
              type: 'string',
              description:
                'A path to a file containing expressions to filter paths to generate types for. One expression is ' +
                'expected per line. Comments are prefixed with `#`. Additional `--filter` expressions will be ' +
                'appended to the considered filters.',
            }),
        async (cliArguments) => {
          const filtersFromFile = cliArguments.filterFile ? await readPathFiltersFromFile(cliArguments.filterFile) : [];
          const filters = [...filtersFromFile, ...cliArguments.filter];

          await generateTypesFromOpenAPISchema({
            inputFilePath: cliArguments.input,
            outputFilePath: cliArguments.output,
            serviceName: cliArguments.serviceName,
            removeComments: cliArguments.removeComments,
            pruneUnused: cliArguments.pruneUnused,
            filters,
          });
        },
      ),
    )

    .parse();
}

export default runCLI;
