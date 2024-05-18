import util from 'util';

import { isClientSide } from './environment';

export async function getChalk() {
  const { default: chalk } = await import('chalk');
  return chalk;
}

export function formatObjectToLog(value: unknown) {
  if (isClientSide()) {
    return value;
  }
  return util.inspect(value, {
    colors: true,
    compact: true,
    depth: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    breakLength: Infinity,
  });
}

export async function logWithPrefix(
  messageOrMessages: unknown,
  options: {
    method?: 'log' | 'warn' | 'error';
  } = {},
) {
  const { method = 'log' } = options;

  const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [messageOrMessages];

  const chalk = await getChalk();
  console[method](chalk.cyan('[zimic]'), ...messages);
}
