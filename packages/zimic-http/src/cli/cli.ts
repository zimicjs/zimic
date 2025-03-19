import color from 'picocolors';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import { generateTypesFromOpenAPI } from '@/typegen';
import { logWithPrefix } from '@/utils/console';
import { usingElapsedTime, formatElapsedTime } from '@/utils/time';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('zimic-http')
    .version(version)
    .showHelpOnFail(false)
    .strict()

    .command('typegen', 'Generate types from schema sources', (yargs) =>
      yargs.demandCommand().command(
        'openapi <input>',
        'Generate types from an OpenAPI schema.',
        (yargs) =>
          yargs
            .positional('input', {
              type: 'string',
              description:
                'The path to a local OpenAPI schema file or an URL to fetch it. ' +
                'Version 3 is supported as YAML or JSON.',
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
                'glob. Filters are case-sensitive regarding paths. For example, `GET /users`, `* /users`, ' +
                '`GET /users/*`, and `GET /users/**/*` are valid filters. Negative filters can be created by ' +
                'prefixing the expression with `!`. For example, `!GET /users` will exclude paths matching ' +
                '`GET /users`. If more than one positive filter is provided, they will be combined with OR, while ' +
                'negative filters will be combined with AND.',
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
          const executionSummary = await usingElapsedTime(async () => {
            await generateTypesFromOpenAPI({
              input: cliArguments.input,
              output: cliArguments.output,
              serviceName: cliArguments.serviceName,
              includeComments: cliArguments.comments,
              prune: cliArguments.prune,
              filters: cliArguments.filter,
              filterFile: cliArguments.filterFile,
            });
          });

          const outputFilePath = cliArguments.output;

          const successMessage =
            `${color.green(color.bold('✔'))} Generated ` +
            `${outputFilePath ? color.green(outputFilePath) : `to ${color.yellow('stdout')}`} ${color.dim(
              `(${formatElapsedTime(executionSummary.elapsedTime)})`,
            )}`;

          const hasWrittenToStdout = outputFilePath === undefined;
          logWithPrefix(successMessage, { method: hasWrittenToStdout ? 'warn' : 'log' });
        },
      ),
    )

    .parse();
}

export default runCLI;
