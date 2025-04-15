import { spawn, SpawnOptions } from 'child_process';

import githubInterceptor, { githubMockData } from '../github';

function runCommand(command: string, commandArguments: string[], options: SpawnOptions) {
  return new Promise<void>((resolve, reject) => {
    const commandProcess = spawn(command, commandArguments, options);

    commandProcess.once('error', (error) => {
      reject(error);
    });

    commandProcess.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command '${command}' exited with code ${code}`));
      }
    });
  });
}

async function runOnReadyCommand() {
  const commandDivisorIndex = process.argv.indexOf('--');

  if (commandDivisorIndex !== -1) {
    const [command, ...commandArguments] = process.argv.slice(commandDivisorIndex + 1);
    await runCommand(command, commandArguments, { stdio: 'inherit' });
  }
}

async function loadInterceptorMockData() {
  await githubInterceptor.start();
  await githubMockData.apply();

  console.log('Interceptor mock data loaded.');

  await runOnReadyCommand();

  await githubInterceptor.stop();
}

void loadInterceptorMockData();
