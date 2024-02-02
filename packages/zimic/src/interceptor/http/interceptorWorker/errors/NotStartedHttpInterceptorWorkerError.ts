class NotStartedHttpInterceptorWorkerError extends Error {
  constructor() {
    super('Worker is not running. Did you forget to call `await worker.start()`?');
  }
}

export default NotStartedHttpInterceptorWorkerError;
