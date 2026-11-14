// Codes in the application range, because Socket.IO has no close codes for these cases.
export const UNSUPPORTED_VERSION_CLOSE_CODE = 4000;
export const UNKNOWN_SESSION_CLOSE_CODE = 4001;
export const UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_CODE = 4002;

export const UNSUPPORTED_LOCAL_TRANSPORT_CLOSE_REASON =
  'Local Socket.IO interceptors support polling; use a remote interceptor for WebSocket transports';
