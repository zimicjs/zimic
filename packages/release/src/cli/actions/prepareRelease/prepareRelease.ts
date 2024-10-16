import { ReleaseConfig } from '@/config/releaseConfig';
import Logger from '@/utils/logger';
import { importExeca } from '@/utils/processes';

import upgradeVersion, { UpgradeMode } from '../upgradeVersion';
import { getGitHubPullRequestURL } from './utils/github';

interface CommandParameters {
  upgradeMode: UpgradeMode;
  partialLabel?: string;
}

interface CommandContext {
  config: ReleaseConfig;
}

async function prepareRelease(parameters: CommandParameters, { config }: CommandContext) {
  const { execa: $ } = await importExeca();

  const log = new Logger(6);

  log.progress('Upgrading version...');

  const { upgradedVersion, isPartialUpgrade } = await upgradeVersion(parameters, { config });
  log.success(`Version upgraded to '${upgradedVersion}'.`);

  const releaseTag = `v${upgradedVersion}${config.tagSuffix ?? ''}`;

  const releaseBranch = `release/${releaseTag}`;
  log.progress(`Creating branch '${releaseBranch}'...`);
  await $('git', ['checkout', '-b', releaseBranch], { stdio: 'inherit' });

  log.progress('Committing version updates...');
  await $('git', ['add', '.'], { stdio: 'inherit' });
  const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;
  await $('git', ['commit', '-m', releaseCommitMessage], { stdio: 'inherit' });

  if (isPartialUpgrade) {
    log.progress(`Creating tag '${releaseTag}'...`);
    await $('git', ['tag', releaseTag], { stdio: 'inherit' });

    log.progress(`Pushing '${releaseTag}' to origin...`);
    await $('git', ['push', 'origin', releaseTag, '--no-verify'], { stdio: 'inherit' });

    log.progress(`Removing partial release branch '${releaseTag}'...`);
    await $('git', ['checkout', '-'], { stdio: 'inherit' });
    await $('git', ['merge', releaseTag, '--no-edit'], { stdio: 'inherit' });
    await $('git', ['push', '--set-upstream', '--no-verify'], { stdio: 'inherit' });
    await $('git', ['branch', '-D', releaseBranch], { stdio: 'inherit' });

    log.success('Partial release prepared!');
    log.info(`Tag created: ${releaseTag}`);
  } else {
    log.progress('Skipping partial tag creation...');

    log.progress(`Pushing '${releaseBranch}' to origin...`);
    await $('git', ['push', 'origin', releaseBranch, '--set-upstream', '--no-verify'], { stdio: 'inherit' });

    log.progress(`Keeping release branch '${releaseTag}'...`);

    const pullRequestURL = getGitHubPullRequestURL(releaseBranch, upgradedVersion, config);

    log.success(`Release prepared: ${releaseBranch}`);
    log.info(`Link to create the release pull request: ${pullRequestURL}`);
  }
}

export default prepareRelease;
