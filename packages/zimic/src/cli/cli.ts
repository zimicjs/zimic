import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import generateTypesFromOpenAPI from '@/typegen/openapi/generate';

import initializeBrowserServiceWorker from './browser/init';
import startInterceptorServer from './server/start';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic')
    .version(version)
    .showHelpOnFail(false)
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
        'Generate types from an OpenAPI schema.',
        (yargs) =>
          yargs
            .positional('input', {
              type: 'string',
              description: 'The path to a local OpenAPI schema file. YAML and JSON are supported.',
              demandOption: true,
            })
            .option('output', {
              type: 'string',
              description:
                'The path to write the generated types to. If not provided, the types will be written to stdout.',
              alias: 'o',
            })
            .option('service-name', {
              type: 'string',
              description: 'The name of the service to use in the generated types.',
              alias: 's',
              demandOption: true,
            })
            .option('comments', {
              type: 'boolean',
              description: 'Whether to include comments in the generated types.',
              alias: 'c',
              default: true,
            })
            .option('prune', {
              type: 'boolean',
              description:
                'Whether to remove unused operations and components from the generated types. This is useful for ' +
                'reducing the size of the output file.',
              alias: 'p',
              default: true,
            })
            .option('filter', {
              type: 'string',
              array: true,
              description:
                'One or more expressions to filter the types to generate. Filters must follow the format ' +
                '`<method> <path>`, where `<method>` is an HTTP method or `*`, and `<path>` is a literal path or a ' +
                'glob. Filters are case-sensitive regarding paths. If more than one filter is provided, they will be ' +
                'combined with OR. For example, `GET /users`, `* /users`, `GET /users/*`, and `GET /users/**/*` are ' +
                'valid filters. Negative filters can be created by prefixing the expression with `!`. For example, ' +
                '`!GET /users` will exclude paths matching `GET /users`.',
              alias: 'f',
            })
            .option('filter-file', {
              type: 'string',
              description:
                'A path to a file containing filter expressions. One expression is expected per line and the format ' +
                'is the same as used in a `--filter` option. Comments are prefixed with `#`. A filter file can be ' +
                'used alongside additional `--filter` expressions.',
              alias: 'F',
            }),
        async (cliArguments) => {
          await generateTypesFromOpenAPI({
            inputFilePath: cliArguments.input,
            outputFilePath: cliArguments.output,
            serviceName: cliArguments.serviceName,
            includeComments: cliArguments.comments,
            prune: cliArguments.prune,
            filters: cliArguments.filter,
            filterFile: cliArguments.filterFile,
          });
        },
      ),
    )

    .parse();
}

export default runCLI;
