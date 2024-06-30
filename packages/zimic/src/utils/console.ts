import chalk from 'chalk';

import { PossiblePromise } from '@/types/utils';

import { isClientSide } from './environment';

let utilSingleton: typeof import('util') | undefined;

async function importUtil() {
  if (!utilSingleton) {
    utilSingleton = await import('util');
  }
  return utilSingleton;
}

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

export async function usingConsoleTime(label: string, callback: () => PossiblePromise<void>) {
  console.time(label);

  try {
    await callback();
  } finally {
    console.timeEnd(label);
  }
}
