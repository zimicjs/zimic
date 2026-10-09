import { HTTP_METHODS } from '@zimic/http';
import { z } from 'zod';

import { base64Schema, httpURLSchema } from '../schemas';

const serializedHttpRequestSchema = z.object({
  url: httpURLSchema,
  method: z.enum(HTTP_METHODS),
  mode: z.enum(['cors', 'navigate', 'no-cors', 'same-origin']),
  headers: z.record(z.string(), z.string()),
  cache: z.enum(['default', 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached']),
  credentials: z.enum(['omit', 'same-origin', 'include']),
  integrity: z.string(),
  keepalive: z.boolean(),
  redirect: z.enum(['follow', 'error', 'manual']),
  referrer: z.string(),
  referrerPolicy: z.enum([
    '',
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
  ]),
  body: z.union([base64Schema, z.null()]),
});

const serializedHttpResponseSchema = z
  .object({
    type: z.enum(['basic', 'cors', 'default', 'error', 'opaque', 'opaqueredirect']),
    action: z.enum(['bypass', 'reject']).optional(),
    status: z.number().int().min(0).max(599),
    statusText: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.union([base64Schema, z.null()]),
  })
  .refine((response) => (response.type === 'error' ? response.status === 0 : response.status >= 200));

export const httpHandlerCommitSchema = z.object({
  id: z.string(),
  baseURL: httpURLSchema,
  method: z.enum(HTTP_METHODS),
  path: z.string(),
});

export const httpHandlerCommitsSchema = z.array(httpHandlerCommitSchema);

export const httpCreateResponseEventSchema = z.object({
  handlerId: z.string(),
  request: serializedHttpRequestSchema,
});

export const httpCreateResponseReplySchema = z.object({
  response: z.union([serializedHttpResponseSchema, z.null()]),
});

export const httpUnhandledResponseEventSchema = z.object({
  request: serializedHttpRequestSchema,
});

export const httpUnhandledResponseReplySchema = z.object({
  wasLogged: z.boolean(),
});
