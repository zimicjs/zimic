import chalk from 'chalk';

import { HttpFormData, HttpHeaders, HttpSearchParams } from '@/http';

import { isClientSide } from './environment';
import { createCachedDynamicImport } from './imports';

const importUtil = createCachedDynamicImport(() => import('util'));

export async function formatObjectToLog(value: unknown, options: { colors?: boolean } = {}) {
  if (isClientSide()) {
    return value;
  }

  const { colors = true } = options;

  const util = await importUtil();

  return util.inspect(value, {
    colors,
    compact: true,
    depth: Infinity,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    breakLength: Infinity,
    sorted: true,
  });
}

function inlineJSONStringify(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/\n\s*/g, ' ');
}

export function stringifyObjectToLog(value: unknown): string {
  if (value instanceof HttpHeaders || value instanceof HttpSearchParams) {
    return stringifyObjectToLog(value.toObject());
  }

  if (value instanceof HttpFormData) {
    const formattedEntries = Array.from(value.entries())
      .map(([key, value]) => `${key}: ${stringifyObjectToLog(value)}`)
      .join(', ');

    return `FormData { ${formattedEntries} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: ${value.type}, size: ${value.size} }`;
  }

  return inlineJSONStringify(value);
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
