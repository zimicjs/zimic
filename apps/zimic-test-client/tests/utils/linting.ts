import { execa as $ } from 'execa';

export function checkTypes(tsconfigFilePath: string) {
  return $('pnpm', ['tsc', '--noEmit', '--project', tsconfigFilePath], {
    stderr: 'inherit',
  });
}

export function lint(input: string, eslintConfigFilePath: string) {
  return $('pnpm', ['lint', input, '--no-ignore', '--max-warnings', '0', '--config', eslintConfigFilePath], {
    stderr: 'inherit',
  });
}
