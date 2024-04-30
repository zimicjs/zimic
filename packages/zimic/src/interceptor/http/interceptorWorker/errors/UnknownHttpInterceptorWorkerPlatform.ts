class UnknownHttpInterceptorWorkerPlatform extends Error {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in Vitest */
  constructor() {
    super('Unknown interceptor worker platform.');
    this.name = 'UnknownHttpInterceptorWorkerPlatform';
  }
}

export default UnknownHttpInterceptorWorkerPlatform;
