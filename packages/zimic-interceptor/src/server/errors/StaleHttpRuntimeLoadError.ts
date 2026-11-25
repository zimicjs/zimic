/** An error thrown when an HTTP runtime load finishes after the interceptor server has stopped or restarted. */
class StaleHttpRuntimeLoadError extends Error {
  constructor() {
    super('The interceptor server stopped or restarted while loading the HTTP runtime.');
    this.name = 'StaleHttpRuntimeLoadError';
  }
}

export default StaleHttpRuntimeLoadError;
