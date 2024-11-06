import { UnhandledRequestStrategy } from '../interceptor/types/options';

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY: UnhandledRequestStrategy.Declaration = {
  action: 'bypass',
  log: true,
};
