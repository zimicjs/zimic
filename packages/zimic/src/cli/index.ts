import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import initializeBrowserServiceWorker from './browser/init';

async function main() {
  await yargs(hideBin(process.argv))
    .version(version)
    .command('browser', 'Browser', (yargs) =>
      yargs
        .command(
          'init <publicDirectory>',
          'Initialize the browser service worker',
          (yargs) =>
            yargs.positional('publicDirectory', {
              type: 'string',
              description: 'The path to the public directory of your application',
              demandOption: true,
            }),
          (cliArguments) => initializeBrowserServiceWorker(cliArguments),
        )
        .demandCommand(),
    )
    .demandCommand()
    .parse();
}

void main();
