import { CLIError } from '@/cli/errors';

export class AppendPartialVersionToNonStringError extends CLIError {
  constructor() {
    super('Cannot append partial version to non-string value.');
  }
}

export class MissingRequiredPartialLabelError extends CLIError {
  constructor() {
    super('Cannot upgrade partial version if there is no partial label.');
  }
}
