import z, { ZodType } from 'zod';

import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';

export function parseInterceptorServerRPCData<Schema extends ZodType>(schema: Schema, data: unknown): z.output<Schema> {
  const validation = schema.safeParse(data);

  if (!validation.success) {
    throw new InvalidWebSocketMessageError(validation.error.message);
  }

  return validation.data;
}
