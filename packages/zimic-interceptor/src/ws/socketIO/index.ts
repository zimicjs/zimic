export { createSocketIOProtocol } from './factory';

export { default as DuplicateSocketIONamespaceError } from './errors/DuplicateSocketIONamespaceError';
export { default as InvalidSocketIOPollingInterceptorError } from './errors/InvalidSocketIOPollingInterceptorError';
export { default as MismatchedSocketIOProtocolOptionsError } from './errors/MismatchedSocketIOProtocolOptionsError';
export { default as SharedSocketIOProtocolError } from './errors/SharedSocketIOProtocolError';

export type { SocketIOAckMessage, SocketIOEventMessage, SocketIOMessage } from './types/messages';
export type { SocketIOParser, SocketIOProtocolOptions } from './types/options';
export type { SocketIOPollingSchema } from './types/polling';
export type { SocketIOSchema } from './types/schema';
