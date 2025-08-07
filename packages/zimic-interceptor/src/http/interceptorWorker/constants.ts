import { HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY = Object.freeze({
  local: Object.freeze<UnhandledRequestStrategy.LocalDeclaration>({
    action: 'reject',
    log: true,
  }),
  remote: Object.freeze<UnhandledRequestStrategy.RemoteDeclaration>({
    action: 'reject',
    log: true,
  }),
} satisfies Record<HttpInterceptorType, Readonly<UnhandledRequestStrategy.Declaration>>);
