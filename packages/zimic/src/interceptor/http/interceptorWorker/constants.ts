import { HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY = Object.freeze({
  local: Object.freeze<UnhandledRequestStrategy.LocalDeclaration>({
    action: 'bypass',
    logWarning: true,
  }),
  remote: Object.freeze<UnhandledRequestStrategy.RemoteDeclaration>({
    action: 'reject',
    logWarning: true,
  }),
} satisfies Record<HttpInterceptorType, Readonly<UnhandledRequestStrategy.Declaration>>);
