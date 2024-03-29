/** Error thrown when trying to start a new HTTP interceptor worker while another one is already running. */
class OtherHttpInterceptorWorkerRunningError extends Error {
  constructor() {
    super(
      'Another HTTP interceptor worker is already running. A single worker can be reused by all of your interceptors' +
        ', so starting multiple workers is not necessary. If you do need other workers, stop the current one first.',
    );
    this.name = 'OtherHttpInterceptorWorkerRunningError';
  }
}

export default OtherHttpInterceptorWorkerRunningError;
