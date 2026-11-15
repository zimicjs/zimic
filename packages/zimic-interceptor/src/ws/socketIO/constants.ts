// Codes in the application range, because Socket.IO has no close codes for these cases.
export const UNSUPPORTED_VERSION_CLOSE_CODE = 4000;
export const UNKNOWN_SESSION_CLOSE_CODE = 4001;
export const UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_CODE = 4002;

export const UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_REASON =
  'Local Socket.IO interceptors support polling; use a remote interceptor for WebSocket transports';

export const POLLING_PACKET_SEPARATOR = '\x1e';

export const OPEN_PACKET_PREFIX = '0';
export const CLOSE_PACKET = '1';
export const PING_PACKET = '2';
export const ENGINE_IO_MESSAGE_PACKET_PREFIX = '4';
export const NOOP_PACKET = '6';
export const UPGRADE_PROBE_PACKET = '2probe';
export const UPGRADE_PROBE_REPLY_PACKET = '3probe';
export const UPGRADE_PACKET = '5';
