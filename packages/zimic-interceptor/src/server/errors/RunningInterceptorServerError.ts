/**
 * An error thrown when the interceptor server is running and some operation requires it to be stopped first.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `@zimic/interceptor/server` API reference}
 */
class RunningInterceptorServerError extends Error {
  constructor(additionalMessage: string) {
    super(`The interceptor server is running.${additionalMessage}`);
    this.name = 'RunningInterceptorServerError';
  }
}

export default RunningInterceptorServerError;
