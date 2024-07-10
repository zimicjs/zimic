import { execa as $ } from 'execa';

import githubInterceptor, { githubFixtures } from '../github';

async function runOnReadyCommand() {
  const commandDivisorIndex = process.argv.indexOf('--');

  if (commandDivisorIndex !== -1) {
    const [onReadyCommand, ...onReadyCommandArguments] = process.argv.slice(commandDivisorIndex + 1);

    await $({
      stdio: 'inherit',
    })(onReadyCommand, onReadyCommandArguments);
  }
}

async function loadInterceptors() {
  await githubInterceptor.start();

  try {
    await githubFixtures.apply();
    console.log('Interceptors loaded.');

    await runOnReadyCommand();
  } finally {
    await githubInterceptor.stop();
  }
}

void loadInterceptors();
