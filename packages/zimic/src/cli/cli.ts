import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '@@/package.json';

import initializeBrowserServiceWorker from './browser/init';
import startServer from './server/start';

async function runCLI() {
  await yargs(hideBin(process.argv))
    .version(version)
    .command('browser', 'Browser', (yargs) =>
      yargs
        .command(
          'init <publicDirectory>',
          'Initialize the browser service worker.',
          (yargs) =>
            yargs.positional('publicDirectory', {
              type: 'string',
              description: 'The path to the public directory of your application.',
              demandOption: true,
            }),
          (cliArguments) => initializeBrowserServiceWorker(cliArguments),
        )
        .demandCommand(),
    )
    .command('server', 'Server', (yargs) =>
      yargs
        .command(
          'start',
          'Start the mock server.',
          (yargs) =>
            yargs
              .option('hostname', {
                type: 'string',
                description: 'The hostname to start the server on.',
                alias: 'h',
                default: '0.0.0.0',
              })
              .option('port', {
                type: 'number',
                description: 'The port to start the server on.',
                alias: 'p',
              })
              .option('on-ready', {
                type: 'string',
                description: 'A command to run when the server is ready.',
              })
              .option('on-ready-shell', {
                type: 'string',
                description: 'The shell to use when running the on-ready command. Defaults to the system shell.',
              })
              .option('ephemeral', {
                type: 'boolean',
                description: 'Whether the server should stop automatically after the on-ready command finishes.',
                default: true,
              }),
          (cliArguments) => startServer(cliArguments),
        )
        .demandCommand(),
    )
    .demandCommand()
    .parse();
}

export default runCLI;
