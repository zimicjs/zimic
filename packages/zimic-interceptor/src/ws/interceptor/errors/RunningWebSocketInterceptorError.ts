class RunningWebSocketInterceptorError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor is running. ${additionalMessage}`);
    this.name = 'RunningWebSocketInterceptorError';
  }
}

export default RunningWebSocketInterceptorError;
