import { execa as $ } from 'execa';

export function checkTypes(tsconfigFilePath: string) {
  return $('pnpm', ['--silent', 'tsc', '--noEmit', '--project', tsconfigFilePath], { stdio: 'inherit' });
}

export function lint(input: string, eslintConfigFilePath: string) {
  return $(
    'pnpm',
    ['--silent', 'lint', input, '--no-ignore', '--max-warnings', '0', '--config', eslintConfigFilePath],
    { stdio: 'inherit' },
  );
}
