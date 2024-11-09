import { HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY = Object.freeze({
  local: { action: 'bypass', logWarning: true } satisfies UnhandledRequestStrategy.Local,
  remote: { action: 'reject', logWarning: true } satisfies UnhandledRequestStrategy.Remote,
} satisfies Record<HttpInterceptorType, UnhandledRequestStrategy>);
