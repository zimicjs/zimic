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
