import { importExeca } from './scripting';

export async function checkTypes(tsconfigFilePath: string) {
  const { $ } = await importExeca();

  return $('pnpm', ['tsc', '--noEmit', '--project', tsconfigFilePath], {
    stderr: 'inherit',
  });
}

export async function lint(input: string, eslintConfigFilePath: string) {
  const { $ } = await importExeca();

  return $('pnpm', ['lint', input, '--no-ignore', '--max-warnings', '0', '--config', eslintConfigFilePath], {
    stderr: 'inherit',
  });
}
