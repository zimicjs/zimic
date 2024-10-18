import { z } from 'zod';

export const CONFIG_FILENAME = 'release.config.js';
export const PACKAGE_JSON_FILENAME = 'package.json';

const metadataFileEntrySchema = z.object({
  path: z.string(),
  versionKey: z.string(),
  partialVersions: z
    .object({
      includeInVersionKey: z.boolean().optional().default(true),
      appendTo: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({ includeInVersionKey: true, appendTo: [] }),
});

export type MetadataFileEntry = z.infer<typeof metadataFileEntrySchema>;

const githubConfigSchema = z.object({
  repositoryOwner: z.string(),
  repositoryName: z.string(),
  productionBranch: z.string(),
});

const releaseConfigSchema = z.object({
  metadata: z.array(metadataFileEntrySchema).min(1),
  tagSuffix: z.string().optional(),
  github: githubConfigSchema,
});

export type ReleaseConfig = z.infer<typeof releaseConfigSchema>;

export const importedReleaseConfigSchema = z.object({
  default: releaseConfigSchema,
});
