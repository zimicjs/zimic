import chalk from 'chalk';

import { HttpFormData, HttpHeaders, HttpSearchParams } from '@/http';

import { isClientSide } from './environment';
import { createCachedDynamicImport } from './imports';

function inlineJSONStringify(value: unknown): string {
  return (
    JSON.stringify(
      value,
      (_key, value: unknown) => {
        if (value instanceof File) {
          return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
        }

        if (value instanceof Blob) {
          return `Blob { type: '${value.type}', size: ${value.size} }`;
        }

        return value;
      },
      2,
    )
      // Remove newlines and spaces after them
      .replace(/\n\s*/g, ' ')
      // Remove double quotes around File and Blob
      .replace(/"(File { name: '.*?', type: '.*?', size: \d*? }|Blob { type: '.*?', size: \d*? })"/g, '$1')
  );
}

export function stringifyObjectToLog(value: unknown, options: { includeSearchParamsClassName?: boolean } = {}): string {
  const { includeSearchParamsClassName = false } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  if (value instanceof HttpHeaders) {
    return stringifyObjectToLog(value.toObject());
  }

  if (value instanceof HttpHeaders || value instanceof HttpSearchParams) {
    return `${includeSearchParamsClassName ? 'URLSearchParams ' : ''}${stringifyObjectToLog(value.toObject())}`;
  }

  if (value instanceof HttpFormData) {
    return `FormData ${stringifyObjectToLog(value.toObject())}`;
  }

  if (value instanceof File) {
    return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: '${value.type}', size: ${value.size} }`;
  }

  return inlineJSONStringify(value);
}

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
