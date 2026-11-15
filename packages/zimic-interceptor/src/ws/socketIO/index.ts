export { createSocketIOProtocol } from './createSocketIOProtocol';

export { default as DuplicateSocketIONamespaceError } from './errors/DuplicateSocketIONamespaceError';
export { default as InvalidSocketIOPollingInterceptorError } from './errors/InvalidSocketIOPollingInterceptorError';
export { default as MismatchedSocketIOProtocolOptionsError } from './errors/MismatchedSocketIOProtocolOptionsError';
export { default as SharedSocketIOProtocolError } from './errors/SharedSocketIOProtocolError';

export type {
  SocketIOAckMessage,
  SocketIOEventMessage,
  SocketIOMessage,
  SocketIOParser,
  SocketIOPollingSchema,
  SocketIOProtocolOptions,
  SocketIOSchema,
} from './types';
