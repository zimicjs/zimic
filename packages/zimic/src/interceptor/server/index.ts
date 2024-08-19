import InterceptorServerNamespace from './namespace/InterceptorServerNamespace';

export { default as NotStartedInterceptorServerError } from './errors/NotStartedInterceptorServerError';

export type { InterceptorServerOptions } from './types/options';
export type { InterceptorServer } from './types/public';

export { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE } from './constants';

/**
 * A namespace of interceptor server resources for handling HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic server` API reference}
 * @see {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors Remote HTTP Interceptors} .
 */
export const interceptorServer = Object.freeze(new InterceptorServerNamespace());

export type { InterceptorServerNamespace };
