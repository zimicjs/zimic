import { $ } from 'zx';

export async function prettifyFiles(filePaths: string[]): Promise<void> {
  await $`pnpm style:format ${filePaths}`;
}
