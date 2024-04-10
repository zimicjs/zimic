import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test'] as const),
  ZIMIC_SERVER_PORT: z.coerce.number().int().positive(),
});

const environment = environmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  ZIMIC_SERVER_PORT: process.env.ZIMIC_SERVER_PORT,
});

export default environment;
