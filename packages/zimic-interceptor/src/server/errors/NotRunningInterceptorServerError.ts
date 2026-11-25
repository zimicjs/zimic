/* istanbul ignore next -- @preserve */
/**
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstart `server.start()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstop `server.stop()` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverisrunning `server.isRunning` API reference}
 */
class NotRunningInterceptorServerError extends Error {
  constructor() {
    super('The interceptor server is not running. Did you forget to start it?');
    this.name = 'NotRunningInterceptorServerError';
  }
}

export default NotRunningInterceptorServerError;
