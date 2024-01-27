export async function getChalk() {
  const { default: chalk } = await import('chalk');
  return chalk;
}

export async function logWithPrefix(message: string) {
  const chalk = await getChalk();
  console.log(`${chalk.cyan('[zimic]')} ${message}`);
}
