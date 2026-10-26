import { HttpHeaders, HttpSearchParams, parseHttpBody } from '@zimic/utils/http';
import { createCachedDynamicImport } from '@zimic/utils/import';
import { Logger } from '@zimic/utils/logging';
import color from 'picocolors';

import { isClientSide } from './environment';

export const logger = new Logger({
  prefix: color.cyan('[@zimic/interceptor]'),
});

const importUtil = createCachedDynamicImport(() => import('util'));

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
    .replace(/"(Blob { type: '.*?', size: \d*? })"/g, '$1')
    .replace(/"(\w+ { byteLength: \d*? })"/g, '$1');
}

export function stringifyValueToLog(value: unknown, options: { fallback?: (value: unknown) => string } = {}): string {
  const { fallback = stringifyJSONToLog } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  if (value instanceof File) {
    return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer { byteLength: ${value.byteLength} }`;
  }

  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name} { byteLength: ${value.byteLength} }`;
  }

  return fallback(value);
}

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

export async function logUnhandledRequestWarning(request: Request, action: 'bypass' | 'reject') {
  const body = await parseHttpBody(request.clone()).catch((error: unknown) => {
    logger.error('Failed to parse request body:', error);
    return null;
  });

  const headers = new HttpHeaders(request.headers);
  const searchParams = new HttpSearchParams(new URL(request.url).searchParams);

  const [formattedHeaders, formattedSearchParams, formattedBody] = await Promise.all([
    formatValueToLog(headers.toObject()),
    formatValueToLog(searchParams.toObject()),
    formatValueToLog(body),
  ]);

  logger[action === 'bypass' ? 'warn' : 'error'](
    `${action === 'bypass' ? 'Warning:' : 'Error:'} Request was not handled and was ` +
      `${action === 'bypass' ? color.yellow('bypassed') : color.red('rejected')}.\n\n `,
    `${request.method} ${request.url}`,
    '\n    Headers:',
    formattedHeaders,
    '\n    Search params:',
    formattedSearchParams,
    '\n    Body:',
    formattedBody,
    '\n\nLearn more: https://zimic.dev/docs/interceptor/guides/http/unhandled-requests',
  );
}
