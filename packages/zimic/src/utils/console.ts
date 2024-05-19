import chalk from 'chalk';
import util from 'util';

import { isClientSide } from './environment';

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

export function logWithPrefix(
  messageOrMessages: unknown,
  options: {
    method?: 'log' | 'warn' | 'error';
  } = {},
) {
  const { method = 'log' } = options;

  const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [messageOrMessages];
  console[method](chalk.cyan('[zimic]'), ...messages);
}
