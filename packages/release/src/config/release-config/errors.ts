import { CLIError } from '@/cli/errors';

import { CONFIG_FILENAME } from './constants';

export class MissingReleaseConfigError extends CLIError {
  constructor() {
    super(`Could not find a file '${CONFIG_FILENAME}' in the current directory or any of its parents.`);
  }
}

export class InvalidReleaseConfigError extends CLIError {
  constructor(originalError: unknown) {
    const originalErrorContainsMessage =
      typeof originalError === 'object' && originalError !== null && 'message' in originalError;
    const originalErrorMessage = originalErrorContainsMessage ? originalError.message : originalError;

    super(`The release config in '${CONFIG_FILENAME}' is invalid: ${originalErrorMessage}`);
  }
}
