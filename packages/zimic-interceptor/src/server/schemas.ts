import { z } from 'zod';

import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';

const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function hasURLProtocol(value: string, protocols: readonly string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const httpURLSchema = z.string().refine((value) => hasURLProtocol(value, ['http:', 'https:']));
export const webSocketURLSchema = z.string().refine((value) => hasURLProtocol(value, ['ws:', 'wss:']));
export const base64Schema = z.string().regex(BASE64_REGEX);

export function parseServerRpcPayload<Schema extends z.ZodType>(schema: Schema, data: unknown): z.output<Schema> {
  const validation = schema.safeParse(data);

  if (!validation.success) {
    throw new InvalidWebSocketMessageError('RPC payload failed validation.');
  }

  return validation.data;
}
