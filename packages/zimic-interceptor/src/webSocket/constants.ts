export const WEB_SOCKET_CONTROL_MESSAGES = ['socket:authenticated'] as const;
export type WebSocketControlMessage = (typeof WEB_SOCKET_CONTROL_MESSAGES)[number];
