export const WEB_SOCKET_CONTROL_MESSAGES = Object.freeze(['socket:auth:valid'] as const);
export type WebSocketControlMessage = (typeof WEB_SOCKET_CONTROL_MESSAGES)[number];

export const WEB_SOCKET_NORMAL_CLOSE_CODE = 1000;
export const WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE = 1002;
export const WEB_SOCKET_INTERNAL_ERROR_CLOSE_CODE = 1011;
