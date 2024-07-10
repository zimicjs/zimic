import { execa as $ } from 'execa';

export async function prettifyFiles(filePaths: string[]): Promise<void> {
  await $('pnpm', ['style:format', ...filePaths], { stdio: 'inherit' });
}
