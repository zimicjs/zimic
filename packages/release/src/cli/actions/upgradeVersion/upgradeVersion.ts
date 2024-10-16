import { ReleaseConfig } from '@/config/releaseConfig';
import { prettifyFiles } from '@/utils/format';

import { UpgradeMode } from './types';
import { warnIfPartialLabelIgnored } from './utils/log';
import {
  readMetadataFileContents,
  getPrimaryVersion,
  writeMetadataFileContents,
  upgradeMetadataFileContents,
} from './utils/metadataFiles';
import { formatVersion, upgradeVersion as upgradeParsedVersion } from './utils/version';

interface CommandContext {
  config: ReleaseConfig;
}

export interface CommandParameters {
  upgradeMode: UpgradeMode;
  partialLabel?: string;
}

async function upgradeVersion(parameters: CommandParameters, { config }: CommandContext) {
  warnIfPartialLabelIgnored(parameters);

  const { metadata: metadataFiles } = config;

  const metadataFileContents = await readMetadataFileContents(metadataFiles);
  const currentPrimaryVersion = getPrimaryVersion(metadataFiles, metadataFileContents);
  const upgradedPrimaryVersion = upgradeParsedVersion(
    currentPrimaryVersion,
    parameters.upgradeMode,
    parameters.partialLabel,
  );

  const isPartialUpgrade =
    parameters.upgradeMode === 'partial' || (parameters.upgradeMode !== 'full' && !!parameters.partialLabel);

  const upgradedMetadataFileContents = upgradeMetadataFileContents(
    metadataFiles,
    metadataFileContents,
    upgradedPrimaryVersion,
    isPartialUpgrade,
  );

  await writeMetadataFileContents(metadataFiles, upgradedMetadataFileContents);
  await prettifyFiles(metadataFiles.map((file) => file.path));

  return {
    upgradedVersion: formatVersion(upgradedPrimaryVersion),
    isPartialUpgrade,
  };
}

export default upgradeVersion;
