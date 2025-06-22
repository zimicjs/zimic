import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  API_GITHUB_TOKEN: z.string().default(''),

  API_URL: z.string().url().default('http://localhost:3001'),
});

export const environment = environmentSchema.parse(process.env);
