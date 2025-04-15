import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production'] as const),
  PORT: z.coerce.number().int().positive().default(3004),

  GITHUB_API_BASE_URL: z.string().url().or(z.literal('')).default(''),

  PLAYWRIGHT_WORKERS: z.coerce.number().default(1),
  PLAYWRIGHT_WORKER_INDEX: z.coerce.number().int().nonnegative().default(0),
});

const environment = environmentSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,

  GITHUB_API_BASE_URL: process.env.GITHUB_API_BASE_URL,

  PLAYWRIGHT_WORKERS: process.env.PLAYWRIGHT_WORKERS,
  PLAYWRIGHT_WORKER_INDEX: process.env.TEST_PARALLEL_INDEX,
});

export default environment;
