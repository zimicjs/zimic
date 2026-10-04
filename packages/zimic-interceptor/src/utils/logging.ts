import { HttpHeaders, HttpSearchParams, parseHttpBody } from '@zimic/utils/http';
import { createCachedDynamicImport } from '@zimic/utils/import';
import { Logger } from '@zimic/utils/logging';
import color from 'picocolors';

import { isClientSide } from './environment';

export const logger = new Logger({
  prefix: color.cyan('[@zimic/interceptor]'),
});

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
