export const WEB_SOCKET_CONTROL_MESSAGES = Object.freeze(['socket:authenticated'] as const);
export type WebSocketControlMessage = (typeof WEB_SOCKET_CONTROL_MESSAGES)[number];
