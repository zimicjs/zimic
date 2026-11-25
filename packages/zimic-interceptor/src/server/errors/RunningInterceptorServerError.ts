/**
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstart `server.start()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstop `server.stop()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverisrunning `server.isRunning` API reference}
 */
class RunningInterceptorServerError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor server is running.${additionalMessage}`);
    this.name = 'RunningInterceptorServerError';
  }
}

export default RunningInterceptorServerError;
