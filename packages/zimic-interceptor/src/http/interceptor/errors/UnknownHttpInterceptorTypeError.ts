import { ValidationError } from '@zimic/utils/validation';

import { HttpInterceptorType } from '../types/options';

/**
 * An error thrown when an unknown interceptor type is used. Currently, the types `local` and `remote` are supported.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor `createHttpInterceptor()` API reference}
 */
class UnknownHttpInterceptorTypeError extends ValidationError {
  constructor(unknownType: unknown) {
    super(
      `Unknown HTTP interceptor type: ${unknownType}. The available options are ` +
        `'${'local' satisfies HttpInterceptorType}' and ` +
        `'${'remote' satisfies HttpInterceptorType}'.`,
    );
    this.name = 'UnknownHttpInterceptorTypeError';
  }
}

export default UnknownHttpInterceptorTypeError;
