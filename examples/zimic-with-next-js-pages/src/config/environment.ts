import * as z from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production'] as const),
  PORT: z.coerce.number().int().positive().default(3006),

  GITHUB_API_BASE_URL: z.url().or(z.literal('')).default(''),

  PLAYWRIGHT_WORKERS: z.coerce.number().default(1),
});

const environment = environmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,

  GITHUB_API_BASE_URL: process.env.NEXT_PUBLIC_GITHUB_API_BASE_URL,

  PLAYWRIGHT_WORKERS: process.env.PLAYWRIGHT_WORKERS,
});

export default environment;
