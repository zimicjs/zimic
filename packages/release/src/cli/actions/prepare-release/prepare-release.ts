import { $ } from 'zx';

import { ReleaseConfig } from '@/config/release-config';
import { withCommandOutputs } from '@/utils/commands';
import Logger from '@/utils/logger';

import upgradeVersion, { UpgradeMode } from '../upgrade-version';
import { getGitHubPullRequestURL } from './utils/github';

interface CommandParameters {
  upgradeMode: UpgradeMode;
  partialLabel?: string;
}

interface CommandContext {
  config: ReleaseConfig;
}

async function prepareRelease(parameters: CommandParameters, { config }: CommandContext) {
  const log = new Logger(6);

  log.progress('Upgrading version...');

  const { upgradedVersion, isPartialUpgrade } = await upgradeVersion(parameters, { config });
  log.success(`Version upgraded to '${upgradedVersion}'.`);

  const releaseTag = `v${upgradedVersion}${config.tagSuffix ?? ''}`;

  const releaseBranch = `release/${releaseTag}`;
  log.progress(`Creating branch '${releaseBranch}'...`);
  await withCommandOutputs($`git checkout -b ${releaseBranch}`);

  log.progress('Committing version updates...');
  await withCommandOutputs($`git add .`);
  const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;
  await withCommandOutputs($`git commit -m ${releaseCommitMessage}`);

  if (isPartialUpgrade) {
    log.progress(`Creating tag '${releaseTag}'...`);
    await withCommandOutputs($`git tag ${releaseTag}`);

    log.progress(`Pushing '${releaseTag}' to origin...`);
    await withCommandOutputs($`git push origin ${releaseTag} --no-verify`);

    log.progress(`Removing partial release branch '${releaseTag}'...`);
    await withCommandOutputs($`git checkout -`);
    await withCommandOutputs($`git merge ${releaseTag} --no-edit`);
    await withCommandOutputs($`git push --set-upstream --no-verify`);
    await withCommandOutputs($`git branch -D ${releaseBranch}`);

    log.success('Partial release prepared!');
    log.info(`Tag created: ${releaseTag}`);
  } else {
    log.progress('Skipping partial tag creation...');

    log.progress(`Pushing '${releaseBranch}' to origin...`);
    await withCommandOutputs($`git push origin ${releaseBranch} --set-upstream --no-verify`);

    log.progress(`Keeping release branch '${releaseTag}'...`);

    const pullRequestURL = getGitHubPullRequestURL(releaseBranch, upgradedVersion, config);

    log.success(`Release prepared: ${releaseBranch}`);
    log.info(`Link to create the release pull request: ${pullRequestURL}`);
  }
}

export default prepareRelease;
