import { HttpInterceptorType } from '../types/options';

class UnknownHttpInterceptorTypeError extends TypeError {
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
