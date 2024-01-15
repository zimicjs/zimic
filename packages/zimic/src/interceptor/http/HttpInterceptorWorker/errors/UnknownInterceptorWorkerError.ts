class UnknownInterceptorWorkerError extends Error {
  constructor(readonly worker: unknown) {
    super(`Worker is not an instance of BrowserWorker or NodeWorker: ${worker}.`);
  }
}

export default UnknownInterceptorWorkerError;
