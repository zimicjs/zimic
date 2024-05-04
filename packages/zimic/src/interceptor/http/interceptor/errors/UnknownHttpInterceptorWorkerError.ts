class UnknownHttpInterceptorWorkerError extends Error {
  constructor(unknownWorker: unknown) {
    super(
      `Unknown HTTP interceptor worker: ${unknownWorker}.` +
        'Are you sure it was created with `createHttpIntercetorWorker(options)`?',
    );
    this.name = 'UnknownHttpInterceptorWorkerError';
  }
}

export default UnknownHttpInterceptorWorkerError;
