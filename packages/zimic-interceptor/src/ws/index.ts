export { default as RunningWebSocketInterceptorError } from './interceptor/errors/RunningWebSocketInterceptorError';
export { default as NotRunningWebSocketInterceptorError } from './interceptor/errors/NotRunningWebSocketInterceptorError';
export { default as UnknownWebSocketInterceptorPlatformError } from './interceptor/errors/UnknownWebSocketInterceptorPlatformError';
export { default as UnknownWebSocketInterceptorTypeError } from './interceptor/errors/UnknownWebSocketInterceptorTypeError';
export { default as MessageSavingSafeLimitExceededError } from './interceptor/errors/MessageSavingSafeLimitExceededError';
export { default as ConnectionSavingSafeLimitExceededError } from './interceptor/errors/ConnectionSavingSafeLimitExceededError';
export { default as UnregisteredBrowserServiceWorkerError } from '@/interceptor/errors/UnregisteredBrowserServiceWorkerError';

export { default as DisabledMessageSavingError } from './messageHandler/errors/DisabledMessageSavingError';
export { default as DisabledConnectionSavingError } from './connectionHandler/errors/DisabledConnectionSavingError';
export { default as WebSocketTimesCheckError } from './errors/WebSocketTimesCheckError';

export type { WebSocketMessageHandlerDelayFactory } from './messageHandler/types/messages';

export type {
  LocalWebSocketMessageHandler,
  RemoteWebSocketMessageHandler,
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageContext,
  WebSocketMessageHandlerMessageStaticDeclaration,
  WebSocketMessageHandlerMessageComputedDeclaration,
  WebSocketMessageHandlerMessageDeclaration,
  SyncedRemoteWebSocketMessageHandler,
  PendingRemoteWebSocketMessageHandler,
  WebSocketMessageHandler,
} from './messageHandler/types/public';

export type {
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerStaticRestriction,
  WebSocketMessageHandlerStaticRestrictionOptions,
  WebSocketMessageHandlerComputedRestriction,
} from './messageHandler/types/restrictions';

export type { WebSocketConnectionHandlerDelayFactory } from './connectionHandler/types/connections';

export type {
  LocalWebSocketConnectionHandler,
  RemoteWebSocketConnectionHandler,
  WebSocketConnectionHandlerConnectionCallback,
  WebSocketConnectionHandlerResponseDeclaration,
  WebSocketConnectionHandlerResponseComputedDeclaration,
  SyncedRemoteWebSocketConnectionHandler,
  PendingRemoteWebSocketConnectionHandler,
  WebSocketConnectionHandler,
} from './connectionHandler/types/public';

export type {
  WebSocketConnectionHandlerRestriction,
  WebSocketConnectionHandlerStaticRestriction,
  WebSocketConnectionHandlerComputedRestriction,
} from './connectionHandler/types/restrictions';

export type {
  WebSocketInterceptorType,
  WebSocketInterceptorPlatform,
  LocalWebSocketInterceptorOptions,
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorOptions,
  WebSocketInterceptorAuthOptions,
  UnhandledMessageStrategy,
} from './interceptor/types/options';

export type { InferWebSocketInterceptorSchema } from './interceptor/types/schema';
export type {
  WebSocketInterceptorConnectionRequest,
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
  WebSocketInterceptorServerSendOptions,
} from './interceptor/types/messages';

export type {
  LocalWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptor,
  WebSocketInterceptorMessageSaving,
  WebSocketInterceptorConnectionSaving,
} from './interceptor/types/public';

export { createWebSocketInterceptor } from './interceptor/factory';
