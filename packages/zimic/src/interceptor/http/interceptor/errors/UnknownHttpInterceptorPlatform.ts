/**
 * An error thrown when an unknown interceptor platform is detected. Currently, the platforms `node` and `browser` are
 * supported.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http-interceptorplatform `interceptor.platform()` API reference}
 */
class UnknownHttpInterceptorPlatform extends Error {
  /* istanbul ignore next -- @preserve
   * Ignoring because checking unknown platforms is currently not possible in our Vitest setup */
  constructor() {
    super('Unknown interceptor platform.');
    this.name = 'UnknownHttpInterceptorPlatform';
  }
}

export default UnknownHttpInterceptorPlatform;
