import { HttpMethodSchema } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorRequest } from './requests';

/**
 * A fixed delay in milliseconds.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference}
 */
export type HttpRequestHandlerFixedDelay = number;

/**
 * A ranged delay in milliseconds. A random value will be selected within the interval `[min, max]`.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference}
 */
export interface HttpRequestHandlerRangedDelay {
  min: number;
  max: number;
}

/**
 * A computed delay in milliseconds. The delay is computed based on the request.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference}
 */
export type HttpRequestHandlerComputedDelay<Path extends string, MethodSchema extends HttpMethodSchema> = (
  request: Omit<HttpInterceptorRequest<Path, MethodSchema>, 'response'>,
) => PossiblePromise<number>;

/**
 * A declaration of a delay to apply before returning a response.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerdelay `handler.delay()` API reference}
 */
export type HttpRequestHandlerDelayDeclaration<Path extends string, MethodSchema extends HttpMethodSchema> =
  | HttpRequestHandlerFixedDelay
  | HttpRequestHandlerRangedDelay
  | HttpRequestHandlerComputedDelay<Path, MethodSchema>;
