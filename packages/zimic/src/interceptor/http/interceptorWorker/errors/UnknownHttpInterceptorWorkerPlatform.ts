class UnknownHttpInterceptorWorkerPlatform extends Error {
  constructor() {
    super('Unknown interceptor worker platform.');
    this.name = 'UnknownHttpInterceptorWorkerPlatform';
  }
}

export default UnknownHttpInterceptorWorkerPlatform;
