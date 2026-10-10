import { z } from 'zod';

import { base64Schema, webSocketURLSchema } from '../schemas';

const serializedWebSocketMessageDataSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('binary'), data: base64Schema }),
  z.object({ type: z.literal('text'), data: z.string() }),
]);

export const webSocketHandlerCommitSchema = z.object({
  id: z.string(),
  baseURL: webSocketURLSchema,
});

export const webSocketHandlerCommitsSchema = z.array(webSocketHandlerCommitSchema);

export const webSocketSendMessageSchema = z.object({
  clientId: z.string().optional(),
  handlerId: z.string().optional(),
  data: serializedWebSocketMessageDataSchema,
});

export const webSocketConnectEventSchema = z.object({
  handlerId: z.string(),
  clientId: z.string(),
  url: webSocketURLSchema,
});

export const webSocketCloseEventSchema = z.object({
  clientId: z.string(),
});

export const webSocketHandleMessageEventSchema = z.object({
  handlerId: z.string(),
  clientId: z.string(),
  data: serializedWebSocketMessageDataSchema,
});

export const webSocketConnectReplySchema = z.object({
  accepted: z.boolean(),
});

export const webSocketMessageReplySchema = z.object({});
