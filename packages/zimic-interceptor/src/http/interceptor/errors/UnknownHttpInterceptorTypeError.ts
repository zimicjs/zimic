import { ValidationError } from '@zimic/utils/validation';

import { HttpInterceptorType } from '../types/options';

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
