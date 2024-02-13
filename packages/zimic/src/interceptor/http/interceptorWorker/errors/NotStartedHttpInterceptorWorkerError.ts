/** Error thrown when the worker is not running and it's not possible to declare mock responses. */
class NotStartedHttpInterceptorWorkerError extends Error {
  constructor() {
    super('Worker is not running. Did you forget to call `await worker.start()`?');
    this.name = 'NotStartedHttpInterceptorWorkerError';
  }
}

export default NotStartedHttpInterceptorWorkerError;
