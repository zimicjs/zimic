export const WEB_SOCKET_CONTROL_MESSAGES = Object.freeze(['socket:auth:valid'] as const);
export type WebSocketControlMessage = (typeof WEB_SOCKET_CONTROL_MESSAGES)[number];
