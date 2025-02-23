import chalk from 'chalk';

export function logWithPrefix(message: string, options: { method: 'log' | 'warn' | 'error' }) {
  const { method } = options;

  console[method](chalk.cyan('[@zimic/http]'), message);
}
