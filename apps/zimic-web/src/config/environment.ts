import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().default('*'),

  API_GITHUB_TOKEN: z.string().default(''),
});

export const environment = environmentSchema.parse(process.env);
