import { Logger } from '@zimic/utils/logging';
import color from 'picocolors';

export const logger = new Logger({
  prefix: color.cyan('[@zimic/http]'),
});
