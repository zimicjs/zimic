import { Callable } from '@/types/utils';

import { log } from './log';

export class CLIError extends Error {}

export function withCLIErrorBoundary<Parameters extends readonly unknown[], ReturnType>(
  callback: Callable<Parameters, ReturnType>,
): Callable<Parameters, ReturnType> {
  return async function wrappedCallback(...parameters: Parameters) {
    try {
      return await callback(...parameters);
    } catch (error) {
      /* istanbul ignore else -- @preserve
       * All errors are expected to be instances of Error. */
      if (error instanceof Error) {
        log.error(error.message);
      }

      console.error(error);
      process.exit(1);
    }
  };
}
