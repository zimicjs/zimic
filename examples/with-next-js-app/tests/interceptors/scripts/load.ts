import { execa as $ } from 'execa';

import githubInterceptor, { githubFixtures } from '../github';

async function runOnReadyCommand() {
  const commandDivisorIndex = process.argv.indexOf('--');

  if (commandDivisorIndex !== -1) {
    const [command, ...commandArguments] = process.argv.slice(commandDivisorIndex + 1);
    await $(command, commandArguments, { stdio: 'inherit' });
  }
}

async function loadInterceptors() {
  await githubInterceptor.start();
  await githubFixtures.apply();

  console.log('Interceptors loaded.');

  await runOnReadyCommand();

  await githubInterceptor.stop();
}

void loadInterceptors();
