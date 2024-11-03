import chalk from 'chalk';

import { isClientSide } from './environment';
import { createCachedDynamicImport } from './imports';

const importUtil = createCachedDynamicImport(() => import('util'));

export async function formatObjectToLog(value: unknown) {
  if (isClientSide()) {
    return value;
  }

  const util = await importUtil();

  return util.inspect(value, {
    colors: true,
    compact: true,
    depth: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    breakLength: Infinity,
    sorted: true,
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
