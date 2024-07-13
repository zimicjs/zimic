import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

import { readReleaseConfig } from '@/config/release-config';

import prepareRelease from './actions/prepare-release';
import upgradeVersion, { UpgradeMode } from './actions/upgrade-version';
import { withCLIErrorBoundary } from './errors';

function withVersionUpgradeParameters(yargs: Argv) {
  return yargs
    .positional('upgradeMode', {
      type: 'string',
      choices: Object.values(UpgradeMode),
      demandOption: true,
    })
    .positional('partialLabel', {
      type: 'string',
      demandOption: false,
    });
}

async function runReleaseCLI() {
  const config = await readReleaseConfig();

  await yargs(hideBin(process.argv))
    .command('$0', 'Manage Zimic releases')

    .command(
      'upgrade <upgradeMode> [partialLabel]',
      'Upgrade the version of the project',
      (yargs) => withVersionUpgradeParameters(yargs),
      async ({ upgradeMode, partialLabel }) => {
        const commandHandler = withCLIErrorBoundary(upgradeVersion);
        await commandHandler({ upgradeMode, partialLabel }, { config });
      },
    )

    .command(
      'prepare <upgradeMode> [partialLabel]',
      'Prepare a full or partial release',
      (yargs) => withVersionUpgradeParameters(yargs),
      async ({ upgradeMode, partialLabel }) => {
        const commandHandler = withCLIErrorBoundary(prepareRelease);
        await commandHandler({ upgradeMode, partialLabel }, { config });
      },
    )

    .demandCommand(1)
    .parse();
}

export default runReleaseCLI;
