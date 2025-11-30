import runCommand from '@zimic/utils/process/runCommand';

export async function checkTypes(tsconfigFilePath: string) {
  return runCommand('pnpm', ['tsc', '--noEmit', '--project', tsconfigFilePath], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

export async function lint(input: string, eslintConfigFilePath: string) {
  return runCommand('pnpm', ['lint', input, '--no-ignore', '--max-warnings', '0', '--config', eslintConfigFilePath], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
