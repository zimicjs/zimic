export { default as RunningWebSocketInterceptorError } from './interceptor/errors/RunningWebSocketInterceptorError';
export { default as NotRunningWebSocketInterceptorError } from './interceptor/errors/NotRunningWebSocketInterceptorError';
export { default as UnknownWebSocketInterceptorPlatformError } from './interceptor/errors/UnknownWebSocketInterceptorPlatformError';
export { default as UnknownWebSocketInterceptorTypeError } from './interceptor/errors/UnknownWebSocketInterceptorTypeError';
export { default as MessageSavingSafeLimitExceededError } from './interceptor/errors/MessageSavingSafeLimitExceededError';

export { default as DisabledMessageSavingError } from './messageHandler/errors/DisabledMessageSavingError';
export { default as TimesCheckError } from '../errors/TimesCheckError';

export type { WebSocketMessageHandlerDelayFactory } from './messageHandler/types/messages';

export type {
  LocalWebSocketMessageHandler,
  RemoteWebSocketMessageHandler,
  SyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
  WebSocketMessageHandler,
} from './messageHandler/types/public';

export type {
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerStaticRestriction,
  WebSocketMessageHandlerComputedRestriction,
} from './messageHandler/types/restrictions';

export type {
  WebSocketInterceptorType,
  WebSocketInterceptorPlatform,
  LocalWebSocketInterceptorOptions,
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorOptions,
} from './interceptor/types/options';

export type { InferWebSocketInterceptorSchema } from './interceptor/types/schema';

export type {
  LocalWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptor,
} from './interceptor/types/public';

export { createWebSocketInterceptor } from './interceptor/factory';
