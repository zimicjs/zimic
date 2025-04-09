import { HttpFormData, HttpHeaders, HttpSearchParams } from '@zimic/http';
import createCachedDynamicImport from '@zimic/utils/import/createCachedDynamicImport';
import Logger from '@zimic/utils/logging/Logger';
import color from 'picocolors';

import { isClientSide } from './environment';
import { isGlobalFileAvailable } from './files';

export const logger = new Logger({
  prefix: color.cyan('[@zimic/interceptor]'),
});

function stringifyJSONToLog(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, value) => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return stringifyValueToLog(value, {
        fallback: (value) => value as string,
      });
    },
    2,
  )
    .replace(/\n\s*/g, ' ')
    .replace(/"(File { name: '.*?', type: '.*?', size: \d*? })"/g, '$1')
    .replace(/"(Blob { type: '.*?', size: \d*? })"/g, '$1');
}

export function stringifyValueToLog(
  value: unknown,
  options: {
    fallback?: (value: unknown) => string;
    includeClassName?: { searchParams?: boolean };
  } = {},
): string {
  const { fallback = stringifyJSONToLog, includeClassName } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  if (value instanceof HttpHeaders) {
    return stringifyValueToLog(value.toObject());
  }

  if (value instanceof HttpHeaders || value instanceof HttpSearchParams) {
    const prefix = (includeClassName?.searchParams ?? false) ? 'URLSearchParams ' : '';
    return `${prefix}${stringifyValueToLog(value.toObject())}`;
  }

  if (value instanceof HttpFormData) {
    return `FormData ${stringifyValueToLog(value.toObject())}`;
  }

  if (isGlobalFileAvailable() && value instanceof File) {
    return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: '${value.type}', size: ${value.size} }`;
  }

  return fallback(value);
}

const importUtil = createCachedDynamicImport(() => import('util'));

export async function formatValueToLog(value: unknown, options: { colors?: boolean } = {}) {
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
