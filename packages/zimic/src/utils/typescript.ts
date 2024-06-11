import { runCommand } from './processes';

export async function checkTypes(tsconfigPath: string) {
  await runCommand('tsc', ['-p', tsconfigPath], { stdio: 'pipe' });
}
