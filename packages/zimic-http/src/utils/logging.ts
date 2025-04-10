import Logger from '@zimic/utils/logging/Logger';
import color from 'picocolors';

export const logger = new Logger({
  prefix: color.cyan('[@zimic/http]'),
});
