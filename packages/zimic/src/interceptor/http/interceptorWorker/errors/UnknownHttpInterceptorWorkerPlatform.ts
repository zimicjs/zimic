class UnknownHttpInterceptorWorkerPlatform extends Error {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in our Vitest setup */
  constructor() {
    super('Unknown interceptor worker platform.');
    this.name = 'UnknownHttpInterceptorWorkerPlatform';
  }
}

export default UnknownHttpInterceptorWorkerPlatform;
