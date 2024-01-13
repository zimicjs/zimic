import { log } from '@/cli/log';

import { CommandParameters } from '../upgrade-version';

export const IGNORED_PARTIAL_LABELS_MESSAGE =
  'Partial labels are ignored when the upgrade mode is `partial` or `full`.';

export function warnIfPartialLabelIgnored({ upgradeMode: versionUpgradeMode, partialLabel }: CommandParameters) {
  const isPartialLabelIgnored = versionUpgradeMode === 'partial' || versionUpgradeMode === 'full';

  if (isPartialLabelIgnored && partialLabel) {
    log.warn(IGNORED_PARTIAL_LABELS_MESSAGE);
  }
}
