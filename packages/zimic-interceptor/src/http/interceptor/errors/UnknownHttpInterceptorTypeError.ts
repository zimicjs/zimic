import { ValidationError } from '@zimic/utils/validation';

import { HttpInterceptorType } from '../types/options';

/** @see {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#createhttpinterceptor `createHttpInterceptor()` API reference} */
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
