import { importExeca } from './processes';

export async function prettifyFiles(filePaths: string[]): Promise<void> {
  const { execa: $ } = await importExeca();

  await $('pnpm', ['style:format', ...filePaths], { stdio: 'inherit' });
}
