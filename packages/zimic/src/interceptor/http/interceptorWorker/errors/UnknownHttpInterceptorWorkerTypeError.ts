import { HttpInterceptorWorkerType } from '../types/options';

class UnknownHttpInterceptorWorkerTypeError extends Error {
  constructor(unknownType: unknown) {
    super(
      `Unknown HTTP interceptor worker type: ${unknownType}. The available options are ` +
        `'${'local' satisfies HttpInterceptorWorkerType}' and ` +
        `'${'remote' satisfies HttpInterceptorWorkerType}'.`,
    );
    this.name = 'UnknownHttpInterceptorWorkerTypeError';
  }
}

export default UnknownHttpInterceptorWorkerTypeError;
