import { HttpInterceptorType } from '../types/options';

class UnknownHttpInterceptorTypeError extends Error {
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
