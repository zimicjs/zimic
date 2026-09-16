export const WEB_SOCKET_CONTROL_MESSAGES = Object.freeze(['socket:auth:valid'] as const);
export type WebSocketControlMessage = (typeof WEB_SOCKET_CONTROL_MESSAGES)[number];

export const WEB_SOCKET_CLOSE_CODES = Object.freeze({
  DEFAULT: 1000,
  PROTOCOL_ERROR: 1002,
  POLICY_VIOLATION: 1008,
  INTERNAL_ERROR: 1011,
} as const);
