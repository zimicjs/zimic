import { MetadataFileEntry, ReleaseConfig } from '@/config/releaseConfig';

export function createMetadataFileEntry(metadataFile?: Partial<MetadataFileEntry>): MetadataFileEntry {
  return {
    path: 'package.json',
    versionKey: 'version',
    partialVersions: {
      includeInVersionKey: true,
      appendTo: [],
    },
    ...metadataFile,
  };
}

export function createReleaseConfig(partialConfig?: Partial<ReleaseConfig>): ReleaseConfig {
  return {
    metadata: [
      createMetadataFileEntry({
        path: 'package.json',
        versionKey: 'version',
      }),
    ],
    github: {
      repositoryOwner: 'zimicjs',
      repositoryName: 'zimic',
      productionBranch: 'main',
    },
    ...partialConfig,
  };
}
