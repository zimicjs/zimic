import { HTTP_METHODS, HttpSchema } from '@zimic/http';

import { DEFAULT_HTTP_SERVER_LIFECYCLE_TIMEOUT } from '@/utils/http';
import { DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT } from '@/utils/webSocket';

export const DEFAULT_SERVER_LIFE_CYCLE_TIMEOUT = DEFAULT_HTTP_SERVER_LIFECYCLE_TIMEOUT;
export const DEFAULT_SERVER_RPC_TIMEOUT = DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT;

const ALLOWED_ACCESS_CONTROL_HTTP_METHODS = HTTP_METHODS.join(',');

export type AccessControlHeaders = HttpSchema.Headers<{
  'access-control-allow-origin': string;
  'access-control-allow-methods': string;
  'access-control-allow-headers': string;
  'access-control-expose-headers': string;
  'access-control-max-age'?: string;
}>;

/** The default access control headers for the server. */
export const DEFAULT_ACCESS_CONTROL_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': ALLOWED_ACCESS_CONTROL_HTTP_METHODS,
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
  'access-control-max-age': process.env.INTERCEPTOR_SERVER_ACCESS_CONTROL_MAX_AGE,
}) satisfies AccessControlHeaders;

/** The default status code for the preflight request. */
export const DEFAULT_PREFLIGHT_STATUS_CODE = 204;

export const DEFAULT_HOSTNAME = 'localhost';
export const DEFAULT_LOG_UNHANDLED_REQUESTS = true;
